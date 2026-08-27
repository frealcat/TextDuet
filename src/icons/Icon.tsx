import type { ReactElement } from 'react';
import type { IconProps } from './types';
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BilingualIcon,
  CacheIcon,
  ChartBarIcon,
  ChartLineIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChipIcon,
  CircleCheckIcon,
  CircleXIcon,
  CloseIcon,
  CloudIcon,
  CogIcon,
  CoinIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FilterIcon,
  GlobeIcon,
  HistoryIcon,
  InfoIcon,
  KeyIcon,
  ListIcon,
  MenuIcon,
  MinusIcon,
  PaletteIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  ReadingIcon,
  RefreshIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
  ShieldCheckIcon,
  SortIcon,
  SparklesIcon,
  SpinnerIcon,
  StopIcon,
  StreamingIcon,
  TagIcon,
  TargetIcon,
  TextDuetMarkIcon,
  TimerIcon,
  TrashIcon,
  TranslationIcon,
} from './index';

/** 全部 icon 名,与下方的 map 一一对应 */
export type IconName =
  | 'textduet-mark'
  | 'translation'
  | 'bilingual'
  | 'reading'
  | 'streaming'
  | 'arrow-right'
  | 'arrow-left-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'globe'
  | 'search'
  | 'filter'
  | 'sort'
  | 'list'
  | 'tag'
  | 'server'
  | 'key'
  | 'plug'
  | 'sparkles'
  | 'cog'
  | 'cloud'
  | 'chip'
  | 'database'
  | 'chart-line'
  | 'chart-bar'
  | 'coin'
  | 'cache'
  | 'history'
  | 'timer'
  | 'target'
  | 'menu'
  | 'check'
  | 'close'
  | 'chevron-right'
  | 'chevron-down'
  | 'plus'
  | 'minus'
  | 'info'
  | 'alert'
  | 'circle-check'
  | 'circle-x'
  | 'eye'
  | 'refresh'
  | 'trash'
  | 'download'
  | 'save'
  | 'shield-check'
  | 'external-link'
  | 'palette'
  | 'play'
  | 'stop'
  | 'spinner';

/** icon 名 → React 组件的查找表(用于 <Icon name="..." /> 写法) */
const iconMap: Record<IconName, (props: IconProps) => ReactElement> = {
  'textduet-mark': TextDuetMarkIcon,
  translation: TranslationIcon,
  bilingual: BilingualIcon,
  reading: ReadingIcon,
  streaming: StreamingIcon,
  'arrow-right': ArrowRightIcon,
  'arrow-left-right': ArrowLeftRightIcon,
  'arrow-up': ArrowUpIcon,
  'arrow-down': ArrowDownIcon,
  globe: GlobeIcon,
  search: SearchIcon,
  filter: FilterIcon,
  sort: SortIcon,
  list: ListIcon,
  tag: TagIcon,
  server: ServerIcon,
  key: KeyIcon,
  plug: PlugIcon,
  sparkles: SparklesIcon,
  cog: CogIcon,
  cloud: CloudIcon,
  chip: ChipIcon,
  database: DatabaseIcon,
  'chart-line': ChartLineIcon,
  'chart-bar': ChartBarIcon,
  coin: CoinIcon,
  cache: CacheIcon,
  history: HistoryIcon,
  timer: TimerIcon,
  target: TargetIcon,
  menu: MenuIcon,
  check: CheckIcon,
  close: CloseIcon,
  'chevron-right': ChevronRightIcon,
  'chevron-down': ChevronDownIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  info: InfoIcon,
  alert: AlertIcon,
  'circle-check': CircleCheckIcon,
  'circle-x': CircleXIcon,
  eye: EyeIcon,
  refresh: RefreshIcon,
  trash: TrashIcon,
  download: DownloadIcon,
  save: SaveIcon,
  'shield-check': ShieldCheckIcon,
  'external-link': ExternalLinkIcon,
  palette: PaletteIcon,
  play: PlayIcon,
  stop: StopIcon,
  spinner: SpinnerIcon,
};

interface IconWrapperProps extends IconProps {
  name: IconName;
}

/**
 * 通用 Icon 入口:`<Icon name="translation" size={20} />`
 * 单文件直接 import 更省打包体积;此处用于需要按名动态选择的场景
 * (如 Sidebar / 状态条 / i18n 字段驱动的渲染)。
 */
export function Icon({ name, size = 24, ...props }: IconWrapperProps): ReactElement {
  const Component = iconMap[name];
  return <Component size={size} {...props} />;
}
