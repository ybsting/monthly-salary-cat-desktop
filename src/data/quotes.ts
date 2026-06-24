export const workQuotes = [
  '月薪没涨，猫粮没降',
  '喵的，又在加班',
  '工资到账三秒，快乐持续一天',
  '今天也在优雅地搬砖',
  '老板画饼，我负责闻味儿',
  '键盘敲冒烟，奖金看不见',
  '周报写完了吗？没有，喵',
  '先别摸，正在假装很忙',
  '收到工资条，尾巴支棱一下',
  '需求又变了？猫猫叹气',
] as const

export type WorkQuote = (typeof workQuotes)[number]
