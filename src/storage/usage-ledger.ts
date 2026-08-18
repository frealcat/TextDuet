import * as z from 'zod/mini';
import type {
  CostSettings,
  TodayUsageSummary,
} from '@/src/core/contracts';
import { evaluateBudgetThresholds } from '@/src/core/cost';
import {
  summarizeUsageRecords,
  updateUsageAggregate,
  type UsageAggregateEntry,
  type UsageAggregateRecord,
} from '@/src/core/usage-ledger';
import type { UsageHistoryDashboard } from '@/src/core/contracts';
import {
  aggregateDailyUsage,
  aggregateUsageByModel,
  shouldDeleteUsageRecord,
} from '@/src/core/usage-history';

const DATABASE_NAME = 'textduet-usage';
const DATABASE_VERSION = 1;
const USAGE_STORE = 'dailyUsage';
const NOTIFICATION_STORE = 'budgetNotifications';
const DATE_CURRENCY_INDEX = 'dateCurrency';

const StoredUsageRecordSchema = z.strictObject({
  key: z.string(),
  date: z.string(),
  dateCurrency: z.string(),
  provider: z.literal('openai-compatible'),
  model: z.string(),
  currency: z.enum(['USD', 'CNY', 'EUR']),
  inputTokens: z.int().check(z.nonnegative()),
  outputTokens: z.int().check(z.nonnegative()),
  actualCost: z.number().check(z.nonnegative()),
  estimatedCost: z.number().check(z.nonnegative()),
  actualCalls: z.int().check(z.nonnegative()),
  estimatedCalls: z.int().check(z.nonnegative()),
});

const NotificationRecordSchema = z.strictObject({
  key: z.string(),
  notifiedThresholds: z.array(z.union([z.literal(50), z.literal(80), z.literal(100)])),
});

type NotificationRecord = z.infer<typeof NotificationRecordSchema>;

export type UsageLedgerEntry = UsageAggregateEntry;

export interface UsageLedgerResult {
  today: TodayUsageSummary;
  crossedThresholds: Array<50 | 80 | 100>;
}

let databasePromise: Promise<IDBDatabase> | undefined;

export async function recordUsage(
  entry: UsageLedgerEntry,
  budget: CostSettings['budget'],
): Promise<UsageLedgerResult> {
  const database = await openDatabase();
  const transaction = database.transaction([USAGE_STORE, NOTIFICATION_STORE], 'readwrite');
  const completion = transactionComplete(transaction);
  const usageStore = transaction.objectStore(USAGE_STORE);
  const notificationStore = transaction.objectStore(NOTIFICATION_STORE);
  const dateCurrency = createDateCurrencyKey(entry.date, entry.currency);
  const recordKey = `${dateCurrency}:${entry.provider}:${entry.model}`;
  const rawRecords = await requestResult<unknown[]>(
    usageStore.index(DATE_CURRENCY_INDEX).getAll(dateCurrency),
  );
  const records = rawRecords.flatMap((record) => {
    const parsed = StoredUsageRecordSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
  const previousTotal = sumTotalCost(records);
  const existing = records.find((record) => record.key === recordKey);
  const updated = updateUsageAggregate(existing, entry, recordKey, dateCurrency);
  usageStore.put(updated);

  const notificationKey = dateCurrency;
  const rawNotification = await requestResult<unknown>(notificationStore.get(notificationKey));
  const parsedNotification = NotificationRecordSchema.safeParse(rawNotification);
  const previousThresholds = parsedNotification.success
    ? parsedNotification.data.notifiedThresholds
    : [];
  const nextTotal = previousTotal - totalCost(existing) + totalCost(updated);
  const budgetResult = evaluateBudgetThresholds(
    nextTotal,
    budget,
    previousThresholds,
  );
  const notification: NotificationRecord = {
    key: notificationKey,
    notifiedThresholds: budgetResult.notifiedThresholds,
  };
  notificationStore.put(notification);
  await completion;

  const nextRecords = [...records.filter((record) => record.key !== recordKey), updated];
  return {
    today: summarizeUsageRecords(
      entry.date,
      entry.currency,
      nextRecords,
      budget,
      notification.notifiedThresholds,
    ),
    crossedThresholds: budgetResult.crossedThresholds,
  };
}

export async function getTodayUsage(
  date: string,
  currency: UsageLedgerEntry['currency'],
  budget: CostSettings['budget'],
): Promise<TodayUsageSummary> {
  const database = await openDatabase();
  const transaction = database.transaction([USAGE_STORE, NOTIFICATION_STORE], 'readonly');
  const completion = transactionComplete(transaction);
  const dateCurrency = createDateCurrencyKey(date, currency);
  const [rawRecords, rawNotification] = await Promise.all([
    requestResult<unknown[]>(
      transaction.objectStore(USAGE_STORE).index(DATE_CURRENCY_INDEX).getAll(dateCurrency),
    ),
    requestResult<unknown>(transaction.objectStore(NOTIFICATION_STORE).get(dateCurrency)),
  ]);
  const records = rawRecords.flatMap((record) => {
    const parsed = StoredUsageRecordSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
  const notification = NotificationRecordSchema.safeParse(rawNotification);
  await completion;

  return summarizeUsageRecords(
    date,
    currency,
    records,
    budget,
    notification.success ? notification.data.notifiedThresholds : [],
  );
}

export async function getUsageHistory(
  endDate: string,
  days: number,
): Promise<UsageHistoryDashboard> {
  const database = await openDatabase();
  const transaction = database.transaction(USAGE_STORE, 'readonly');
  const completion = transactionComplete(transaction);
  const rawRecords = await requestResult<unknown[]>(transaction.objectStore(USAGE_STORE).getAll());
  const records = rawRecords.flatMap((record) => {
    const parsed = StoredUsageRecordSchema.safeParse(record);
    return parsed.success ? [parsed.data] : [];
  });
  await completion;

  const points = aggregateDailyUsage(records, endDate, days);
  return {
    days,
    points,
    totalInputTokens: points.reduce((sum, point) => sum + point.inputTokens, 0),
    totalOutputTokens: points.reduce((sum, point) => sum + point.outputTokens, 0),
    hasEstimatedUsage: points.some((point) => point.hasEstimatedUsage),
    models: aggregateUsageByModel(records, endDate, days),
    isLedgerAvailable: true,
    source: 'local',
  };
}

export async function clearUsageLedger(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([USAGE_STORE, NOTIFICATION_STORE], 'readwrite');
  const completion = transactionComplete(transaction);
  transaction.objectStore(USAGE_STORE).clear();
  transaction.objectStore(NOTIFICATION_STORE).clear();
  await completion;
}

/** Applies the rolling retention policy and removes pre-policy estimated token aggregates. */
export async function maintainUsageLedger(retentionStartDate: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([USAGE_STORE, NOTIFICATION_STORE], 'readwrite');
  const completion = transactionComplete(transaction);
  const usageStore = transaction.objectStore(USAGE_STORE);
  const notificationStore = transaction.objectStore(NOTIFICATION_STORE);
  const [rawUsageRecords, rawNotifications] = await Promise.all([
    requestResult<unknown[]>(usageStore.getAll()),
    requestResult<unknown[]>(notificationStore.getAll()),
  ]);

  for (const rawRecord of rawUsageRecords) {
    const parsed = StoredUsageRecordSchema.safeParse(rawRecord);
    if (parsed.success && shouldDeleteUsageRecord(parsed.data, retentionStartDate)) {
      usageStore.delete(parsed.data.key);
    }
  }
  for (const rawNotification of rawNotifications) {
    const parsed = NotificationRecordSchema.safeParse(rawNotification);
    if (parsed.success && parsed.data.key.slice(0, 10) < retentionStartDate) {
      notificationStore.delete(parsed.data.key);
    }
  }
  await completion;
}

function createDateCurrencyKey(date: string, currency: string): string {
  return `${date}:${currency}`;
}

function sumTotalCost(records: UsageAggregateRecord[]): number {
  return records.reduce((sum, record) => sum + totalCost(record), 0);
}

function totalCost(record: UsageAggregateRecord | undefined): number {
  return record ? record.actualCost + record.estimatedCost : 0;
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(USAGE_STORE)) {
        const usageStore = database.createObjectStore(USAGE_STORE, { keyPath: 'key' });
        usageStore.createIndex(DATE_CURRENCY_INDEX, 'dateCurrency', { unique: false });
      }
      if (!database.objectStoreNames.contains(NOTIFICATION_STORE)) {
        database.createObjectStore(NOTIFICATION_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(new Error('无法打开本地用量账本'));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error('本地用量账本暂时不可用'));
    };
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('读取本地用量账本失败'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('保存本地用量账本失败'));
    transaction.onabort = () => reject(new Error('保存本地用量账本失败'));
  });
}
