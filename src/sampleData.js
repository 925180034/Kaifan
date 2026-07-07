export const moodOptions = [
  { id: "lazy", label: "偷懒", helper: "20 分钟内,少洗碗" },
  { id: "normal", label: "正常", helper: "均衡、省心" },
  { id: "treat", label: "想吃好点", helper: "奖励自己" }
];

export const defaultProfile = {
  peopleCount: "2",
  allergies: [],
  dislikes: ["香菜", "内脏"],
  spicyLevel: "mild",
  tasteTags: ["清淡", "微辣", "少油"],
  budgetPerPerson: "30_60",
  cookingWillingness: "normal",
  cuisinePreferences: ["家常", "川湘", "江浙"],
  favoriteIngredients: ["虾仁", "豆腐", "番茄"],
  nutritionGoal: "高蛋白控油"
};

export const defaultDailyContext = {
  dateText: "今天 7月6日 · 小雨 18°C",
  mood: "normal",
  weather: {
    text: "小雨",
    temperature: 18,
    isRaining: true
  }
};

export const recipeOptions = [
  {
    id: "cook-tomato-shrimp-tofu",
    type: "cook",
    title: "番茄虾仁豆腐饭 + 拍黄瓜",
    subtitle: "食材可控,干净又实惠",
    reason: "你今天选择正常模式,这套不用复杂备菜,蛋白质也够。",
    estimatedMinutes: 25,
    estimatedCostPerPerson: 28,
    costText: "约¥28/人",
    timeText: "25分钟",
    difficulty: "easy",
    complexity: "easy",
    baseScore: 78,
    accent: "green",
    nutritionSummary: {
      calories: "约620 kcal/人",
      protein: "约34g/人",
      note: "蛋白质充足,油脂适中"
    },
    ingredients: [
      { name: "虾仁", amount: "200g", group: "肉蛋奶" },
      { name: "嫩豆腐", amount: "1盒", group: "主食豆制品" },
      { name: "番茄", amount: "2个", group: "蔬菜水果" },
      { name: "黄瓜", amount: "1根", group: "蔬菜水果" },
      { name: "米饭", amount: "2碗", group: "主食豆制品" },
      { name: "葱姜蒜", amount: "少量", group: "调料干货" }
    ],
    steps: [
      "番茄切块,黄瓜拍碎,虾仁用少量盐和料酒抓匀。",
      "热锅少油炒番茄至出汁,加入豆腐和半碗水煮 6 分钟。",
      "放入虾仁煮至变色,用盐和生抽调味。",
      "黄瓜用蒜末、醋、生抽和少量香油拌匀,配米饭上桌。"
    ],
    searchKeywords: ["番茄", "虾仁", "嫩豆腐", "黄瓜"],
    primaryAction: { label: "看菜谱", action: "view_recipe" }
  },
  {
    id: "cook-egg-noodle",
    type: "cook",
    title: "青菜鸡蛋热汤面",
    subtitle: "一锅完成,洗碗压力低",
    reason: "偷懒模式下,热汤面 15 分钟能上桌,雨天也舒服。",
    estimatedMinutes: 15,
    estimatedCostPerPerson: 12,
    costText: "约¥12/人",
    timeText: "15分钟",
    difficulty: "easy",
    complexity: "easy",
    baseScore: 70,
    accent: "green",
    nutritionSummary: {
      calories: "约520 kcal/人",
      protein: "约22g/人",
      note: "适合赶时间,可加鸡胸肉提高蛋白质"
    },
    ingredients: [
      { name: "挂面", amount: "200g", group: "主食豆制品" },
      { name: "鸡蛋", amount: "2个", group: "肉蛋奶" },
      { name: "小青菜", amount: "200g", group: "蔬菜水果" },
      { name: "生抽", amount: "少量", group: "调料干货" }
    ],
    steps: [
      "水开下面条,另起锅煎两个荷包蛋。",
      "面快熟时加入青菜,用生抽和盐调汤底。",
      "盛出后放荷包蛋,按口味加一点醋或辣椒油。"
    ],
    searchKeywords: ["挂面", "鸡蛋", "小青菜"],
    primaryAction: { label: "看菜谱", action: "view_recipe" }
  },
  {
    id: "cook-beef-potato",
    type: "cook",
    title: "土豆炖牛腩 + 蒜蓉生菜",
    subtitle: "想吃好点的一顿家常硬菜",
    reason: "今天想吃好点时,这套更有满足感,也适合两个人慢慢吃。",
    estimatedMinutes: 55,
    estimatedCostPerPerson: 48,
    costText: "约¥48/人",
    timeText: "55分钟",
    difficulty: "normal",
    complexity: "rich",
    baseScore: 66,
    accent: "green",
    nutritionSummary: {
      calories: "约760 kcal/人",
      protein: "约42g/人",
      note: "饱腹感强,适合不赶时间的晚上"
    },
    ingredients: [
      { name: "牛腩", amount: "500g", group: "肉蛋奶" },
      { name: "土豆", amount: "2个", group: "蔬菜水果" },
      { name: "生菜", amount: "1颗", group: "蔬菜水果" },
      { name: "八角", amount: "1颗", group: "调料干货" }
    ],
    steps: [
      "牛腩焯水后洗净,土豆切块。",
      "牛腩加姜片、八角、生抽和热水炖 35 分钟。",
      "加入土豆再炖 15 分钟,收汁调味。",
      "生菜快速炒蒜蓉,保持脆感。"
    ],
    searchKeywords: ["牛腩", "土豆", "生菜"],
    primaryAction: { label: "看菜谱", action: "view_recipe" }
  }
];

export const takeoutOptions = [
  {
    id: "takeout-noodle",
    type: "takeout",
    title: "热汤面 / 砂锅粥 / 轻食鸡胸饭",
    subtitle: "选择多,送到家",
    reason: "今晚有雨,外卖比出门更省心,搜索时优先少油高评分。",
    estimatedMinutes: 35,
    estimatedCostPerPerson: 34,
    costText: "约¥25-40/人",
    timeText: "30-60分钟",
    baseScore: 74,
    accent: "amber",
    searchKeywords: ["热汤面", "少油", "高评分"],
    primaryAction: { label: "去美团搜", action: "open_meituan" }
  },
  {
    id: "takeout-malatang",
    type: "takeout",
    title: "可选菜麻辣烫",
    subtitle: "想吃辣但还能控菜量",
    reason: "你能接受微辣,选菜型外卖比固定套餐更容易避开忌口。",
    estimatedMinutes: 40,
    estimatedCostPerPerson: 32,
    costText: "约¥25-38/人",
    timeText: "35-55分钟",
    baseScore: 62,
    accent: "amber",
    searchKeywords: ["麻辣烫", "少油", "可选菜"],
    primaryAction: { label: "去美团搜", action: "open_meituan" }
  }
];

export const dineOutOptions = [
  {
    id: "dine-yue",
    type: "dine_out",
    title: "附近粤菜小馆",
    subtitle: "氛围好,犒劳自己",
    reason: "如果今晚想吃好点,粤菜相对清淡,适合两个人慢慢吃。",
    estimatedMinutes: 75,
    estimatedCostPerPerson: 88,
    costText: "约¥50-100/人",
    timeText: "60-90分钟+",
    baseScore: 64,
    accent: "blue",
    searchKeywords: ["附近", "粤菜", "双人", "人均100以内"],
    primaryAction: { label: "去点评搜", action: "open_dianping" }
  },
  {
    id: "dine-japanese",
    type: "dine_out",
    title: "附近日式简餐",
    subtitle: "一人食和双人都轻松",
    reason: "想出门但不想太重口时,日式简餐更稳,也不需要复杂点菜。",
    estimatedMinutes: 70,
    estimatedCostPerPerson: 75,
    costText: "约¥60-90/人",
    timeText: "60-80分钟",
    baseScore: 60,
    accent: "blue",
    searchKeywords: ["附近", "日料", "简餐", "不排队"],
    primaryAction: { label: "去点评搜", action: "open_dianping" }
  }
];

export const initialDecisionCards = [
  recipeOptions[0],
  takeoutOptions[0],
  dineOutOptions[0]
];
