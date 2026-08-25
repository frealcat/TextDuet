// 简体中文（zh-CN）UI 文案字典。
// 内容直接从源代码中按行抽取；占位符使用 {name} 形式保持不变。
// 下一阶段会基于本文件生成英文翻译字典。

import type { MessageDict } from '../types';

export const MESSAGES_ZH_CN: MessageDict = {
  // ---- Popup ----
  // 顶部品牌区
  'popup.brand.title': 'TextDuet',
  'popup.brand.subtitle': '自己的模型，自己的阅读方式',

  // 控制卡片（语言、模型、主操作、显示模式）
  'popup.controls.aria': '网页翻译控制',
  'popup.model.label': '使用模型',
  'popup.button.processing': '处理中…',
  'popup.button.stop': '停止翻译',
  'popup.button.translate': '翻译当前网页',
  'popup.button.setup': '配置模型后开始',
  'popup.display.aria': '网页显示模式',
  'popup.display.bilingual': '双语',
  'popup.display.sourceOnly': '原文',
  'popup.display.translatedOnly': '译文',
  'popup.quickAction.label': '选区快捷翻译图标',

  // 今日用量卡片
  'popup.cost.aria': '今日模型用量',
  'popup.cost.title': '今日用量',
  'popup.cost.estimated': '含估算',
  'popup.cost.inputOutput': '输入 {input} · 输出 {output}',
  'popup.cost.budgetNote': '达到 100% 仅提醒',
  'popup.cost.ledgerWarning': '本地账本暂时不可用',
  'popup.cost.loading': '正在读取本地摘要…',

  // 状态信息（弹窗气泡）
  'popup.status.readSettingsError': '无法读取扩展配置',
  'popup.status.readDashboardError': '无法读取本地用量摘要',
  'popup.status.translating': '正在提取并翻译网页…',
  'popup.status.translateStarted': '翻译已开始',
  'popup.status.translateFailed': '翻译失败',
  'popup.status.langSaveFailed': '语言偏好保存失败',
  'popup.status.stopped': '已停止翻译',
  'popup.status.stopFailed': '停止翻译失败',
  'popup.status.modeChangeFailed': '切换显示模式失败',
  'popup.status.modeChanged': '显示模式已切换',
  'popup.status.quickActionFailed': '快捷翻译设置失败',
  'popup.status.modelChanged': '模型已切换',
  'popup.status.modelChangeFailed': '切换模型失败',

  // 底部状态行
  'popup.footer.modelPending': '模型待配置',
  'popup.footer.noApiKey': '尚未配置 API Key',
  'popup.footer.openSettings': '设置',

  // 预算进度状态文案
  'popup.budget.reached': '已达到预算 · {percent}%',
  'popup.budget.near': '接近预算 · {percent}%',
  'popup.budget.half': '已使用一半 · {percent}%',
  'popup.budget.used': '预算已用 {percent}%',

  // ---- Options（主 App）----
  // 顶部品牌区
  'options.brand.eyebrow': '本地优先 · 用户自带模型',
  'options.brand.title': '连接你的翻译模型',
  'options.brand.description':
    '网页文本会从浏览器直接发送给你选择的模型服务商，不经过本项目的服务器。',

  // 01 模型服务
  'options.section.provider.title': '模型服务',
  'options.apiKey.badge.saved': '已保存密钥',
  'options.apiKey.badge.empty': '尚未配置',
  'options.providerPresets.aria': '服务商预设',
  'options.apiBaseUrl.pathNote': '插件会自动追加 ',
  'options.apiBaseUrl.qwenNote':
    '使用阿里云百炼 OpenAI 兼容模式；请填写百炼控制台中已开通的模型名称。',
  'options.apiKey.placeholderSaved': '已保存；留空表示不修改',
  'options.apiKey.placeholderNew': '粘贴你的 API Key',
  'options.modelTag.placeholderExample': '例如：your-model-name',

  // 02 密钥与默认偏好
  'options.section.preferences.title': '密钥与默认偏好',
  'options.apiKey.persistenceLegend': 'API Key 保存方式',
  'options.quickAction.label': '选中文字后显示快捷翻译图标',
  'options.quickAction.hint': '关闭后仍可通过右键菜单翻译选区。',
  'options.headerPopup.label': '页面顶部菜单的弹出内容也参与翻译',
  'options.headerPopup.hint':
    '适用于 GitHub / Stack Overflow 这类点击头像后挂出的菜单。开启后点击顶部菜单会触发一次额外重扫，关闭则只翻译主文档流。',

  // 03 高级翻译指令
  'options.section.prompt.title': '高级翻译指令',
  'options.section.prompt.optional': '可选',
  'options.prompt.aria': '自定义系统提示词',
  'options.prompt.placeholder':
    '留空时使用内置的安全翻译提示词。后续可在这里加入术语、文风或行业要求。',

  // 04~07 子卡片（具体键名在各子模块分组里）
  // 底部操作条
  'options.action.processing': '处理中…',
  'options.action.testConnection': '测试连接',
  'options.action.saveConfig': '保存配置',
  'options.status.testConnectionSuccess': '连接成功',
  'options.status.testConnectionFailed': '连接测试失败',
  'options.status.saveFailed': '保存失败',
  'options.status.operationFailed': '操作失败',
  'options.status.readConfigFailed': '读取配置失败，请重新加载扩展后重试',
  'options.status.configSaved': '配置已保存',
  'options.status.connecting': '正在连接模型…',
  'options.error.httpsRequired': 'API 地址必须使用 HTTPS',
  'options.error.originPermissionRequired': '需要访问模型 API 域名才能发送翻译请求',

  // ---- 费用提醒设置 ----
  'cost.section.title': '费用提醒设置',
  'cost.section.optional': '可选',
  'cost.disclaimer':
    '手动价格只用于翻译前预估与本地预算提醒，不会作为账单金额展示；最终费用以厂商账单为准。',
  'cost.price.enableLabel': '为当前模型启用费用预估',
  'cost.price.currency': '币种',
  'cost.price.inputPerMillion': '每百万输入 token',
  'cost.price.outputPerMillion': '每百万输出 token',
  'cost.price.disclaimer':
    '价格由你手动维护，不会从官方查询结果自动写入。绑定模型：{model} · 更新于 {date}',
  'cost.price.modelEmpty': '尚未填写',
  'cost.budget.enableLabel': '启用每日预算提醒',
  'cost.budget.dailyLimit': '每日预算（{currency}）',
  'cost.budget.thresholdsNote': '达到 50%、80%、100% 时各提醒一次；100% 不会自动阻止翻译。',
  'cost.budget.todaySummary': '今日预算进度',
  'cost.budget.fullyReached': '达到 100% 仅提醒，由你决定是否继续。',
  'cost.action.processing': '处理中…',
  'cost.action.save': '保存费用提醒',
  'cost.status.priceModelRequired': '请先填写模型名称，再启用该模型的价格估算',
  'cost.status.budgetPositiveRequired': '启用每日预算时，预算金额必须大于 0',
  'cost.status.saveFailed': '保存费用提醒配置失败',
  'cost.status.saved': '费用提醒配置已保存',
  'cost.status.readFailed': '读取费用提醒配置失败，请重新加载扩展后重试',

  // ---- 本地翻译缓存 ----
  'cache.section.title': '本地翻译缓存',
  'cache.section.badge': '仅保存在本机',
  'cache.disclaimer':
    '相同文本、语言、模型和提示词优先复用本地译文，减少重复等待和模型费用。缓存不包含 API Key 或网页 URL。',
  'cache.summary.entries': '缓存条目',
  'cache.summary.usage': '本地占用',
  'cache.summary.loading': '读取中…',
  'cache.ttlNote': '固定保留 {days} 天；达到容量上限后优先清理最久未使用的译文。',
  'cache.unavailable': '本地缓存暂时不可用；翻译仍可继续，但不会复用或保存译文。',
  'cache.action.processing': '清理中…',
  'cache.action.clear': '清空翻译缓存',
  'cache.confirm.clear': '确定清空所有本地译文缓存吗？模型配置和用量账本会保留。',
  'cache.status.readFailed': '读取本地翻译缓存失败，请重新加载扩展后重试',
  'cache.status.cleared': '本地翻译缓存已清空',
  'cache.status.clearFailed': '清空本地翻译缓存失败',

  // ---- Token 用量看板 ----
  'usage.section.title': 'Token 用量',
  'usage.section.badge': '最近 60 天',
  'usage.disclaimer':
    '只统计 Provider 响应返回的实际输入、输出 token；记录保存在本机并滚动保留最近 60 天，不读取或替代厂商账单。',
  'usage.totalGrid.aria': '最近 60 天 token 汇总',
  'usage.total.inputLabel': '输入 token',
  'usage.total.outputLabel': '输出 token',
  'usage.total.totalLabel': '总计 token',
  'usage.loading': '正在读取本地用量…',
  'usage.unavailable': '本地账本暂时不可用，当前无法展示历史用量。',
  'usage.empty': '最近 60 天暂无 Provider 返回的 token 用量。',
  'usage.toolbar.label': '按模型查看每日输入 / 输出',
  'usage.modelFilter.aria': '选择用量模型',
  'usage.modelList.aria': '各模型最近 60 天 token 汇总',
  'usage.modelList.input': '输入 {tokens}',
  'usage.modelList.output': '输出 {tokens}',
  'usage.modelList.total': '合计 {tokens}',
  'usage.pricing.title': '{provider} 官方模型价格',
  'usage.pricing.summary': '输入 {input} · 输出 {output} / 百万 token · 查询于 {date}',
  'usage.pricing.source': '核对来源',
  'usage.balance.title': 'DeepSeek 账户余额',
  'usage.balance.refresh': '查询余额',
  'usage.balance.refreshing': '查询中…',
  'usage.balance.available': '余额可用',
  'usage.balance.insufficient': '余额不足',
  'usage.balance.checkedAt': '查询于 {date}',
  'usage.balance.listItem': '{currency} 可用余额',
  'usage.balance.topupGranted': '充值 {topup} · 赠送 {granted}',
  'usage.balance.officialLink': '官方余额接口',
  'usage.balance.notice':
    '使用当前已保存的 DeepSeek API Key 查询；余额不会写入本地账本。',
  'usage.action.processing': '处理中…',
  'usage.action.clear': '清空本地用量',
  'usage.confirm.clear': '确定清空所有本地用量记录吗？价格与预算配置会保留。',
  'usage.status.readFailed': '读取本地 token 用量失败，请重新加载扩展后重试',
  'usage.status.cleared': '本地用量记录已清空',
  'usage.status.clearFailed': '清空本地用量失败',
  'usage.status.balanceUpdated': 'DeepSeek 余额已更新',
  'usage.status.balanceFailed': '查询 DeepSeek 余额失败',
  'usage.status.balanceConfigRequired': '请先保存 DeepSeek 官方 API 配置',

  // ---- 用量折线图 ----
  'usage.chart.series.input': '输入',
  'usage.chart.series.output': '输出',
  'usage.chart.ariaLabel':
    '{model} 最近 {days} 天输入和输出 token 用量折线图，纵轴单位为 {axisName}',
  'usage.chart.dataRow': '{date}：输入 {input}，输出 {output} token',

  // ---- 兼容性诊断 ----
  'diagnostics.section.title': '兼容性诊断',
  'diagnostics.section.badge': '默认仅本地',
  'diagnostics.disclaimer':
    '诊断包只包含主机名、可选路径和翻译计数，不包含正文、URL 参数、API Key、截图或自动上传。请先在目标网页启动一次翻译，再回到这里为最近翻译的页面生成。',
  'diagnostics.issueType.label': '问题类型',
  'diagnostics.issueType.missed': '遗漏内容',
  'diagnostics.issueType.wrongContent': '译文不正确',
  'diagnostics.issueType.duplicateTranslation': '重复翻译',
  'diagnostics.issueType.layout': '页面布局',
  'diagnostics.issueType.dynamicContent': '动态内容',
  'diagnostics.issueType.performance': '性能问题',
  'diagnostics.issueType.other': '其他',
  'diagnostics.pathConsent.title': '包含当前页面路径',
  'diagnostics.pathConsent.hint': '路径可能识别具体文章；默认不包含。',
  'diagnostics.screenshotNote': '截图诊断暂未启用，不会采集或写入任何截图。',
  'diagnostics.action.processing': '生成中…',
  'diagnostics.action.generate': '生成本地预览',
  'diagnostics.action.download': '下载诊断包',
  'diagnostics.preview.aria': '兼容性诊断包预览',
  'diagnostics.status.reading': '正在读取当前页面的脱敏计数…',
  'diagnostics.status.failed': '无法生成诊断包',
  'diagnostics.status.generated': '诊断包已在本机生成，请先检查预览',
  'diagnostics.status.downloaded': '诊断包已下载到本机',
  'diagnostics.status.pathIncluded': '已同意包含当前页面路径，请重新生成预览',
  'diagnostics.status.pathExcluded': '已移除路径包含选项，请重新生成预览',

  // ---- 译文显示设置 ----
  'appearance.aria': '阅读显示设置',
  'appearance.displayMode.label': '默认显示方式',
  'appearance.displayMode.bilingual': '显示原文与译文',
  'appearance.displayMode.sourceOnly': '只显示原文',
  'appearance.displayMode.translatedOnly': '只显示译文',
  'appearance.translationColor.label': '译文文字颜色',
  'appearance.translationColor.pickerLabel': '取色盘',
  'appearance.translationColor.inputLabel': 'RGBA 或 # 十六进制',
  'appearance.translationColor.placeholder': '#9c5e2e 或 rgba(156, 94, 46, 0.9)',
  'appearance.translationColor.invalid':
    '请输入有效的 #RGB、#RRGGBB、#RRGGBBAA、rgb() 或 rgba()。',

  // ---- 模型标签输入 ----
  'modelTag.fieldLabel': '可用模型',
  'modelTag.tag.current': '当前',
  'modelTag.tag.removeAria': '删除模型 {model}',
  'modelTag.tag.removeTitle': '删除 {model}',
  'modelTag.input.aria': '添加模型名称或 code',
  'modelTag.input.placeholderAdd': '输入后按回车添加',
  'modelTag.hint': '回车或逗号生成标签；点击标签切换当前模型，Popup 中也可切换。',
  'modelTag.feedback.switched': '已切换到 {model}',
  'modelTag.feedback.maxReached': '最多可配置 {max} 个模型',
  'modelTag.feedback.addedSelected': '已添加并选中 {model}',
  'modelTag.feedback.removed': '已移除 {model}',

  // ---- API Key 持久化选项 ----
  'persistence.session.title': '仅本次浏览器会话',
  'persistence.session.description': '推荐。关闭浏览器后自动清除，需要下次重新输入。',
  'persistence.local.title': '持久保存在本机',
  'persistence.local.description': '使用更方便，但浏览器扩展本地存储并不是加密保险箱。',

  // ---- 语言方向选择器 ----
  'languagePair.aria': '语言方向',
  'languagePair.sourceLabel': '当前语言',
  'languagePair.targetLabel': '翻译到',
  'languagePair.followSystem': '跟随系统（{language}）',

  // ---- 内容脚本（translator.ts）----
  // popup 调用后台时返回的消息
  'translator.message.startedPage': '已开始翻译当前网页',
  'translator.message.startedSelection': '已开始翻译选中文本',
  'translator.message.quickActionUpdated': '选区快捷翻译设置已更新',
  'translator.message.stopped': '已停止翻译',
  'translator.message.displayModeChanged': '显示模式已切换',

  // 网页浮层状态条文案
  'translator.status.checkingContent': '正在检查当前已加载内容…',
  'translator.status.noContent': '当前已加载区域没有找到可翻译正文，继续等待新内容',
  'translator.status.contentTranslated': '当前已加载内容已翻译，共 {count} 段；继续监听滚动加载的新内容',
  'translator.status.translateFailed': '网页翻译失败',
  'translator.status.preparingFirst': '正在准备首批译文…',
  'translator.status.translatingBatch': '正在翻译第 {current}/{total} 批（共 {count} 段）…',
  'translator.status.stopped': '已停止翻译，原文和已完成译文保持不变',
  'translator.status.processedSnapshot':
    '已处理 {count} 段{fragments}；页面内容有更新，正在继续检查',
  'translator.status.translatedSnapshot':
    '已翻译当前加载内容，共处理 {count} 段{fragments}；继续监听滚动加载的新内容',
  'translator.status.cacheHits': '；本地缓存命中 {hit}/{total} 段',
  'translator.status.costRecorded': '；本次{amount}，今日{today}',
  'translator.status.budgetReached': '；今日用量已达到预算 {percent}%',
  'translator.status.budgetFullNote': '（仅提醒，不会自动阻止）',
  'translator.status.cacheUnavailable': '；本地缓存暂时不可用',

  // 错误信息
  'translator.error.streamDisconnected': '流式翻译连接已断开',
  'translator.error.costEstimateFailed': '无法生成成本预估',
  'translator.error.costFormatInvalid': '成本预估格式无效',

  // 选区翻译
  'translator.selection.error.changed': '选中文本已变化，请重新选择',
  'translator.selection.error.tooLong': '选区过长',
  'translator.selection.error.invalidAnchor': '请选择正文段落中的文本',
  'translator.selection.error.noTranslation': '模型没有返回译文',
  'translator.selection.error.apiKey': '请先配置 API Key',
  'translator.selection.error.format': '模型返回格式无效',
  'translator.selection.error.generic': '选区翻译失败',
  'translator.selection.quickAction.label': '翻译选中文本',

  // ---- Language selector (Options 顶部) ----
  // 用户在 Options 顶部第 00 张卡选择扩展 UI 的展示语言；auto 跟随浏览器
  // navigator.language，命中 en-* / zh-*；未命中回退 zh-CN。
  'language.section.title': '语言 / Language',
  'language.section.description': '选择扩展 UI 的展示语言。Auto 会跟随浏览器语言偏好。',
  'language.option.auto.label': 'Auto · 跟随浏览器',
  'language.option.auto.description': '根据浏览器 navigator.language 推断；最常见的中文 / 英文环境无需切换',
  'language.option.zh-CN.label': '简体中文',
  'language.option.zh-CN.description': '固定使用 zh-CN 字典，忽略浏览器语言',
  'language.option.en.label': 'English',
  'language.option.en.description': 'Pin to English regardless of browser language',

  // ---- Custom UI language management (Options step 06) ----
  // Lets the user pick a language we don't ship (ja-JP, fr-FR, ...) and
  // trigger a one-shot translation request against their configured
  // Provider. The result lands in storage.local keyed by tag + prompt
  // version, and is loaded on next Options / Popup open.
  'language.custom.title': '自定义 UI 语言',
  'language.custom.optional': '可选',
  'language.custom.description':
    '点击下方任一语种会用你配置的模型把插件界面翻译过去并保存到本机；之后打开 Options / Popup 即用该语言。',
  'language.custom.allDownloaded': '所有常用语种都已下载；如需其他语种可在下方输入 BCP-47 标签。',
  'language.custom.inputLabel': '自定义 BCP-47 标签',
  'language.custom.translateButton': '翻译并切换',
  'language.custom.entriesUnit': '条',
  'language.custom.listTitle': '已下载的自定义语言',
  'language.custom.retranslate': '重新翻译',
  'language.custom.remove': '移除',
  'language.custom.clearAll': '清空全部',
  'language.custom.confirmClearAll': '确定要清空所有已下载的自定义语言吗？此操作不会影响你当前选择的语言。',
  'language.custom.translatePrompt': '当前选择的语言尚未下载，点击上方按钮开始翻译。',
  'language.custom.empty': '尚未下载任何自定义语言；点击常用语种或输入 BCP-47 标签开始翻译。',
};
