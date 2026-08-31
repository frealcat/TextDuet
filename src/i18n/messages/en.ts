// English (en) UI message dictionary.
// Translated from the zh-CN source. Placeholders ({name}, {count}) are kept
// verbatim, and proper nouns (TextDuet, provider names, technical tokens)
// remain in their canonical form.

import type { MessageDict } from '../types';

export const MESSAGES_EN: MessageDict = {
  // ---- Popup ----
  // Top brand area
  'popup.brand.title': 'TextDuet',
  'popup.brand.subtitle': 'Your model, your reading style',

  // Control card (language, model, primary action, display mode)
  'popup.controls.aria': 'Webpage translation controls',
  'popup.model.label': 'Model',
  'popup.button.processing': 'Processing…',
  'popup.button.stop': 'Stop translation',
  'popup.button.translate': 'Translate current page',
  'popup.button.setup': 'Configure a model to begin',
  'popup.display.aria': 'Webpage display mode',
  'popup.display.bilingual': 'Bilingual',
  'popup.display.sourceOnly': 'Source only',
  'popup.display.translatedOnly': 'Translation only',
  'popup.quickAction.label': 'Show quick-translate icon on selection',
  'popup.consent.title': 'Before the first translation',
  'popup.consent.description': 'The visible webpage text you choose to translate is sent directly to the provider you select. Your provider may charge you. TextDuet does not receive or proxy this data.',
  'popup.consent.confirm': 'I understand and continue',
  'popup.consent.loading': 'Checking privacy confirmation…',
  'popup.consent.error': 'Unable to read the privacy confirmation. Please try again.',
  'popup.consent.confirmFailed': 'Unable to save your confirmation. Please try again.',

  // Today's usage card
  'popup.cost.aria': "Today's model usage",
  'popup.cost.title': "Today's usage",
  'popup.cost.estimated': 'Estimate included',
  'popup.cost.inputOutput': 'Input {input} · Output {output}',
  'popup.cost.budgetNote': 'Reaching 100% only shows a reminder',
  'popup.cost.totalTokens': '{count} tokens',
  'popup.cost.ledgerWarning': 'Local ledger temporarily unavailable',
  'popup.cost.loading': 'Loading local summary…',

  // Status messages (popup toasts)
  'popup.status.readSettingsError': 'Unable to read extension settings',
  'popup.status.readDashboardError': 'Unable to read local usage summary',
  'popup.status.translating': 'Extracting and translating the page…',
  'popup.status.translateStarted': 'Translation started',
  'popup.status.translateFailed': 'Translation failed',
  'popup.status.langSaveFailed': 'Failed to save language preference',
  'popup.status.stopped': 'Translation stopped',
  'popup.status.stopFailed': 'Failed to stop translation',
  'popup.status.modeChangeFailed': 'Failed to switch display mode',
  'popup.status.modeChanged': 'Display mode switched',
  'popup.status.quickActionFailed': 'Failed to update quick-translate setting',
  'popup.status.modelChanged': 'Model switched',
  'popup.status.modelChangeFailed': 'Failed to switch model',

  // Bottom status line
  'popup.footer.modelPending': 'Model not configured',
  'popup.footer.noApiKey': 'API key not configured',
  'popup.footer.openSettings': 'Settings',
  'popup.settings.aria': 'Open TextDuet settings',

  // Budget progress status messages
  'popup.budget.reached': 'Budget reached · {percent}%',
  'popup.budget.near': 'Near budget · {percent}%',
  'popup.budget.half': 'Halfway used · {percent}%',
  'popup.budget.used': 'Budget used {percent}%',

  // ---- Options (main App) ----
  // Top brand area
  'options.brand.eyebrow': 'Local-first · bring your own model',
  'options.brand.title': 'Connect your translation model',
  'options.brand.description':
    'Webpage text is sent directly from the browser to the model provider you choose — never through this project’s servers.',

  // 01 Model provider
  'options.section.provider.title': 'Model provider',
  'options.apiKey.badge.saved': 'Key saved',
  'options.apiKey.badge.empty': 'Not configured',
  'options.providerPresets.aria': 'Provider presets',
  'options.apiBaseUrl.pathNote': 'The extension automatically appends ',
  'options.apiBaseUrl.qwenNote':
    'Uses Alibaba Bailian OpenAI-compatible mode. Enter the model name you have activated in the Bailian console.',
  'options.apiKey.placeholderSaved': 'Saved; leave blank to keep unchanged',
  'options.apiKey.placeholderNew': 'Paste your API key',
  'options.modelTag.placeholderExample': 'e.g. your-model-name',
  'options.apiBaseUrl.label': 'API Base URL',
  'options.apiKey.label': 'API key',
  'options.sidebar.aria': 'Settings navigation',
  'options.sidebar.expand': 'Expand navigation',
  'options.sidebar.collapse': 'Collapse navigation',
  'options.sidebar.language': 'Language',
  'options.sidebar.model': 'Model',
  'options.sidebar.usage': 'Usage',
  'options.sidebar.advanced': 'Advanced',

  // 02 Key and default preferences
  'options.section.preferences.title': 'Key and default preferences',
  'options.apiKey.persistenceLegend': 'API key storage',
  'options.quickAction.label': 'Show quick-translate icon when text is selected',
  'options.quickAction.hint':
    'You can still translate selections from the right-click menu when this is off.',
  'options.headerPopup.label': 'Also translate dropdowns opened from the top menu',
  'options.headerPopup.hint':
    'Useful for menus that hang off avatars on sites like GitHub or Stack Overflow. When on, opening a top-menu triggers an extra rescan; when off, only the main document is translated.',

  // 03 Advanced translation prompt
  'options.section.prompt.title': 'Advanced translation prompt',
  'options.section.prompt.optional': 'Optional',
  'options.prompt.aria': 'Custom system prompt',
  'options.prompt.placeholder':
    'Leave blank to use the built-in safe translation prompt. You can add terminology, style, or industry requirements here.',

  // 04–07 sub-cards (specific keys are grouped in their submodules)
  // Bottom action bar
  'options.action.processing': 'Processing…',
  'options.action.testConnection': 'Test connection',
  'options.action.saveConfig': 'Save configuration',
  'options.status.testConnectionSuccess': 'Connection successful',
  'options.status.testConnectionFailed': 'Connection test failed',
  'options.status.saveFailed': 'Save failed',
  'options.status.operationFailed': 'Operation failed',
  'options.status.readConfigFailed': 'Failed to read configuration. Please reload the extension and try again.',
  'options.status.configSaved': 'Configuration saved',
  'options.status.connecting': 'Connecting to model…',
  'options.error.httpsRequired': 'API URL must use HTTPS',
  'options.error.originPermissionRequired':
    'Permission to access the model API domain is required before sending translation requests',

  // ---- Cost reminder settings ----
  'cost.section.title': 'Cost reminder settings',
  'cost.section.optional': 'Optional',
  'cost.disclaimer':
    'Manual pricing is only used for pre-translation estimates and local budget reminders — it is never shown as a billing amount. Final charges are determined by the provider.',
  'cost.price.enableLabel': 'Enable cost estimate for the current model',
  'cost.price.currency': 'Currency',
  'cost.price.inputPerMillion': 'Per million input tokens',
  'cost.price.outputPerMillion': 'Per million output tokens',
  'cost.price.disclaimer':
    'Prices are maintained manually and are never auto-written from official lookups. Bound model: {model} · Updated {date}',
  'cost.price.modelEmpty': 'Not yet filled in',
  'cost.budget.enableLabel': 'Enable daily budget reminder',
  'cost.budget.dailyLimit': 'Daily budget ({currency})',
  'cost.budget.thresholdsNote': 'Reminders fire at 50%, 80%, and 100%. Reaching 100% does not auto-stop translation.',
  'cost.budget.todaySummary': "Today's budget progress",
  'cost.budget.fullyReached':
    'Reaching 100% only shows a reminder — you decide whether to keep going.',
  'cost.action.processing': 'Processing…',
  'cost.action.save': 'Save cost reminder',
  'cost.status.priceModelRequired':
    'Enter a model name first before enabling the price estimate for it',
  'cost.status.budgetPositiveRequired':
    'When the daily budget is enabled, the amount must be greater than 0',
  'cost.status.saveFailed': 'Failed to save cost reminder settings',
  'cost.status.saved': 'Cost reminder settings saved',
  'cost.status.readFailed': 'Failed to read cost reminder settings. Please reload the extension and try again.',

  // ---- Local translation cache ----
  'cache.section.title': 'Local translation cache',
  'cache.section.badge': 'Stored locally only',
  'cache.disclaimer':
    'When the same text, language, model, and prompt come up again, the local translation is reused first — saving wait time and model cost. The cache does not include the API key or webpage URLs.',
  'cache.summary.entries': 'Cached entries',
  'cache.summary.usage': 'Local usage',
  'cache.summary.loading': 'Loading…',
  'cache.ttlNote':
    'Kept for {days} days. When the capacity cap is reached, the least-recently-used entries are removed first.',
  'cache.unavailable':
    'Local cache is temporarily unavailable. Translation continues, but cached translations will not be reused or stored.',
  'cache.action.processing': 'Clearing…',
  'cache.action.clear': 'Clear translation cache',
  'cache.confirm.clear':
    'Clear all locally cached translations? Your model configuration and usage ledger will be kept.',
  'cache.status.readFailed': 'Failed to read the local translation cache. Please reload the extension and try again.',
  'cache.status.cleared': 'Local translation cache cleared',
  'cache.status.clearFailed': 'Failed to clear the local translation cache',

  // ---- Token usage dashboard ----
  'usage.section.title': 'Token usage',
  'usage.section.badge': 'Last 60 days',
  'usage.disclaimer':
    'Only the actual input and output tokens reported by the provider are counted. Records are kept locally and rolled over the most recent 60 days — they do not read or replace the provider’s bill.',
  'usage.totalGrid.aria': 'Last 60 days token totals',
  'usage.total.inputLabel': 'Input tokens',
  'usage.total.outputLabel': 'Output tokens',
  'usage.total.totalLabel': 'Total tokens',
  'usage.loading': 'Loading local usage…',
  'usage.unavailable': 'Local ledger temporarily unavailable; historical usage cannot be shown right now.',
  'usage.empty': 'No provider-reported token usage in the last 60 days.',
  'usage.toolbar.label': 'Daily input / output by model',
  'usage.modelFilter.aria': 'Select usage model',
  'usage.modelList.aria': 'Last 60 days token totals by model',
  'usage.modelList.input': 'Input {tokens}',
  'usage.modelList.output': 'Output {tokens}',
  'usage.modelList.total': 'Total {tokens}',
  'usage.pricing.title': '{provider} official model pricing',
  'usage.pricing.summary': 'Input {input} · Output {output} per million tokens · Fetched {date}',
  'usage.pricing.source': 'Verify source',
  'usage.balance.title': 'DeepSeek account balance',
  'usage.balance.refresh': 'Check balance',
  'usage.balance.refreshing': 'Checking…',
  'usage.balance.available': 'Balance available',
  'usage.balance.insufficient': 'Insufficient balance',
  'usage.balance.checkedAt': 'Checked {date}',
  'usage.balance.listItem': '{currency} available balance',
  'usage.balance.topupGranted': 'Top-up {topup} · Granted {granted}',
  'usage.balance.officialLink': 'Official balance endpoint',
  'usage.balance.notice':
    'Uses the DeepSeek API key currently saved. The balance is not written to the local ledger.',
  'usage.action.processing': 'Processing…',
  'usage.action.clear': 'Clear local usage',
  'usage.confirm.clear':
    'Clear all local usage records? Your pricing and budget configuration will be kept.',
  'usage.status.readFailed': 'Failed to read local token usage. Please reload the extension and try again.',
  'usage.status.cleared': 'Local usage records cleared',
  'usage.status.clearFailed': 'Failed to clear local usage',
  'usage.status.balanceUpdated': 'DeepSeek balance updated',
  'usage.status.balanceFailed': 'Failed to check DeepSeek balance',
  'usage.status.balanceConfigRequired': 'Please save the DeepSeek official API configuration first',

  // ---- Usage line chart ----
  'usage.chart.series.input': 'Input',
  'usage.chart.series.output': 'Output',
  'usage.chart.ariaLabel':
    'Line chart of {model} input and output token usage over the last {days} days; the y-axis is in {axisName}',
  'usage.chart.dataRow': '{date}: input {input}, output {output} tokens',

  // ---- Compatibility diagnostics ----
  'diagnostics.section.title': 'Compatibility diagnostics',
  'diagnostics.section.badge': 'Local only by default',
  'diagnostics.disclaimer':
    'The diagnostic report contains only the host name, optional path, and translation counts — never the page body, URL parameters, API key, screenshots, or automatic uploads. Run a translation on the target page first, then come back here to generate a report for the most recently translated page.',
  'diagnostics.issueType.label': 'Issue type',
  'diagnostics.issueType.missed': 'Missed content',
  'diagnostics.issueType.wrongContent': 'Incorrect translation',
  'diagnostics.issueType.duplicateTranslation': 'Duplicate translation',
  'diagnostics.issueType.layout': 'Page layout',
  'diagnostics.issueType.dynamicContent': 'Dynamic content',
  'diagnostics.issueType.performance': 'Performance',
  'diagnostics.issueType.other': 'Other',
  'diagnostics.pathConsent.title': 'Include the current page path',
  'diagnostics.pathConsent.hint': 'The path can identify a specific article; excluded by default.',
  'diagnostics.screenshotNote':
    'Screenshot diagnostics are not enabled — no screenshots are captured or written.',
  'diagnostics.action.processing': 'Generating…',
  'diagnostics.action.generate': 'Generate local preview',
  'diagnostics.action.download': 'Download diagnostic report',
  'diagnostics.preview.aria': 'Compatibility diagnostic report preview',
  'diagnostics.status.reading': 'Reading redacted counts for the current page…',
  'diagnostics.status.failed': 'Unable to generate the diagnostic report',
  'diagnostics.status.generated': 'Diagnostic report generated locally. Please review the preview first.',
  'diagnostics.status.downloaded': 'Diagnostic report downloaded to this machine',
  'diagnostics.status.pathIncluded':
    'Current page path included. Please regenerate the preview.',
  'diagnostics.status.pathExcluded':
    'Path inclusion removed. Please regenerate the preview.',

  // ---- Translation appearance settings ----
  'appearance.aria': 'Reading display settings',
  'appearance.displayMode.label': 'Default display mode',
  'appearance.displayMode.bilingual': 'Show source and translation',
  'appearance.displayMode.sourceOnly': 'Show source only',
  'appearance.displayMode.translatedOnly': 'Show translation only',
  'appearance.translationColor.label': 'Translation text color',
  'appearance.translationColor.pickerLabel': 'Color picker',
  'appearance.translationColor.inputLabel': 'RGBA or # hexadecimal',
  'appearance.translationColor.placeholder': '#9c5e2e or rgba(156, 94, 46, 0.9)',
  'appearance.translationColor.invalid':
    'Please enter a valid #RGB, #RRGGBB, #RRGGBBAA, rgb(), or rgba() value.',

  // ---- Model tag input ----
  'modelTag.fieldLabel': 'Available models',
  'modelTag.tag.current': 'Current',
  'modelTag.tag.removeAria': 'Remove model {model}',
  'modelTag.tag.removeTitle': 'Remove {model}',
  'modelTag.input.aria': 'Add a model name or code',
  'modelTag.input.placeholderAdd': 'Type and press Enter to add',
  'modelTag.hint':
    'Press Enter or comma to create a tag. Click a tag to switch the current model — you can also switch from the popup.',
  'modelTag.feedback.switched': 'Switched to {model}',
  'modelTag.feedback.maxReached': 'A maximum of {max} models can be configured',
  'modelTag.feedback.addedSelected': '{model} added and selected',
  'modelTag.feedback.removed': '{model} removed',

  // ---- API key persistence options ----
  'persistence.session.title': 'This browser session only',
  'persistence.session.description':
    'Recommended. Cleared automatically when the browser closes — re-enter the key next time.',
  'persistence.local.title': 'Stored persistently on this machine',
  'persistence.local.description':
    'Protected by a password-unlocked AES-GCM vault. The vault is locked again after the browser restarts.',
  'vault.section.title': 'Local encrypted vault',
  'vault.section.badge': 'Password protected',
  'vault.state.notCreated': 'No vault has been created',
  'vault.state.locked': 'Vault locked',
  'vault.state.unlocked': 'Vault unlocked for this browser session',
  'vault.password.createLabel': 'Create vault password',
  'vault.password.unlockLabel': 'Unlock vault password',
  'vault.password.confirmLabel': 'Confirm password',
  'vault.password.placeholder': 'At least 8 characters',
  'vault.action.create': 'Create vault',
  'vault.action.unlock': 'Unlock vault',
  'vault.action.lock': 'Lock vault',
  'vault.action.delete': 'Delete vault and stored keys',
  'vault.action.processing': 'Working…',
  'vault.action.clearCache': 'Clear encrypted translation cache',
  'vault.hint': 'Persistent API keys and cached translations are encrypted locally. The password is never stored; a browser restart requires unlocking again.',
  'vault.hint.locked': 'Unlock the vault before saving or using a persistent API key.',
  'vault.confirm.delete': 'Delete the vault, all persistent API keys, and all locally cached translations? This cannot be undone.',
  'vault.confirm.clearCache': 'Clear all locally cached translations? Your encrypted vault and persistent API keys will remain.',
  'vault.status.created': 'Encrypted vault created',
  'vault.status.unlocked': 'Vault unlocked',
  'vault.status.locked': 'Vault locked',
  'vault.status.deleted': 'Vault and stored secrets deleted',
  'vault.status.cacheCleared': 'Encrypted translation cache cleared',
  'vault.status.passwordMismatch': 'Passwords do not match',
  'vault.status.passwordRequired': 'Enter a vault password',
  'vault.status.failed': 'Vault operation failed',

  // ---- Language direction selector ----
  'languagePair.aria': 'Language direction',
  'languagePair.sourceLabel': 'Current language',
  'languagePair.targetLabel': 'Translate to',
  'languagePair.followSystem': 'Follow system ({language})',
  'languagePair.swap': 'Swap',
  'languagePair.swapTitle': 'Swap source and target languages',

  // ---- Content script (translator.ts) ----
  // Messages returned to the popup when it calls the background
  'translator.message.startedPage': 'Started translating the current page',
  'translator.message.startedSelection': 'Started translating the selected text',
  'translator.message.quickActionUpdated': 'Quick-translate setting updated',
  'translator.message.stopped': 'Translation stopped',
  'translator.message.displayModeChanged': 'Display mode switched',

  // Webpage overlay status bar messages
  'translator.status.checkingContent': 'Checking currently loaded content…',
  'translator.status.noContent':
    'No translatable text was found in the loaded region. Continuing to wait for new content.',
  'translator.status.contentTranslated':
    'Loaded content translated — {count} segments. Continuing to watch for newly loaded content.',
  'translator.status.translateFailed': 'Webpage translation failed',
  'translator.status.preparingFirst': 'Preparing the first batch of translations…',
  'translator.status.translatingBatch':
    'Translating batch {current}/{total} ({count} segments)…',
  'translator.status.stopped':
    'Translation stopped. Source text and finished translations are kept as-is.',
  'translator.status.processedSnapshot':
    'Processed {count} segments{fragments}; the page content changed — continuing to check',
  'translator.status.translatedSnapshot':
    'Loaded content translated — processed {count} segments{fragments}. Continuing to watch for newly loaded content.',
  'translator.status.cacheHits': '; local cache hits {hit}/{total} segments',
  'translator.status.costRecorded': '; this run {amount}, today {today}',
  'translator.status.budgetReached': '; today’s usage has reached {percent}% of budget',
  'translator.status.budgetFullNote': ' (reminder only — does not auto-stop)',
  'translator.status.cacheUnavailable': '; local cache is temporarily unavailable',

  // Error messages
  'translator.error.streamDisconnected': 'Streaming translation connection dropped',
  'translator.error.costEstimateFailed': 'Unable to generate a cost estimate',
  'translator.error.costFormatInvalid': 'Invalid cost estimate format',

  // Selection translation
  'translator.selection.error.changed': 'The selected text has changed. Please re-select.',
  'translator.selection.error.tooLong': 'Selection is too long',
  'translator.selection.error.invalidAnchor': 'Please select text inside a body paragraph',
  'translator.selection.error.noTranslation': 'The model did not return a translation',
  'translator.selection.error.apiKey': 'Please configure the API key first',
  'translator.selection.error.format': 'The model returned an invalid format',
  'translator.selection.error.consent': 'Please confirm the privacy notice in Popup or Options first',
  'translator.selection.error.generic': 'Selection translation failed',
  'translator.selection.quickAction.label': 'Translate selection',

  // ---- Language selector (Options top card) ----
  // Sits as the FIRST card on the Options page; lets the user pin the UI
  // locale or follow the browser default. `auto` resolves via
  // navigator.language (en-* → en, zh-* → zh-CN, else → zh-CN).
  'language.section.title': 'Language',
  'language.section.description':
    'Choose the display language of the extension UI. Auto follows the browser language preference.',
  'language.option.auto.label': 'Auto · follow browser',
  'language.option.auto.description':
    'Resolved from navigator.language; most Chinese and English users do not need to change this',
  'language.option.zh-CN.label': '简体中文',
  'language.option.zh-CN.shortLabel': '中',
  'language.option.zh-CN.description': 'Pin to zh-CN regardless of the browser language',
  'language.option.en.label': 'English',
  'language.option.en.description': 'Pin to English regardless of the browser language',

  // ---- Custom UI language management (Options step 06) ----
  // Mirrors zh-CN: see that file for behavioural details.
  'language.custom.title': 'Custom UI language',
  'language.custom.optional': 'Optional',
  'language.custom.description':
    'Click a preset to translate the extension UI using your configured model and save the result locally. The locale will load automatically next time you open Options or Popup.',
  'language.custom.allDownloaded': 'All common presets are downloaded. Type a BCP-47 tag below for any other language.',
  'language.custom.inputLabel': 'Custom BCP-47 tag',
  'language.custom.inputPlaceholder': 'e.g. fr-FR / ja-JP / zh-TW',
  'language.custom.translateButton': 'Translate and switch',
  'language.custom.preparing': 'Preparing translation to {language}…',
  'language.custom.progress': 'Translating to {language}… {done}/{total}',
  'language.custom.completed': 'Translated to {language}',
  'language.custom.translateFailed': 'Unable to translate the UI language. Please try again.',
  'language.custom.invalidTag': 'Enter a valid BCP-47 tag, such as fr-FR or ja-JP.',
  'language.custom.entriesUnit': 'entries',
  'language.custom.listTitle': 'Downloaded custom languages',
  'language.custom.retranslate': 'Re-translate',
  'language.custom.remove': 'Remove',
  'language.custom.clearAll': 'Clear all',
  'language.custom.confirmClearAll': 'Remove every downloaded custom language? Your current language selection is not affected.',
  'language.custom.translatePrompt': 'The currently selected language has not been downloaded yet. Press the button above to start translation.',
  'language.custom.empty': 'No custom languages downloaded yet. Click a preset or type a BCP-47 tag to translate the UI.',
};
