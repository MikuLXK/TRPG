import type { ScriptDefinition } from '../../types/Script';

export const dndCurseOfStrahd: ScriptDefinition = {
  id: 'dnd-curse-of-strahd',
  title: '龙与地下城：斯特拉德的诅咒',
  description:
    '迷雾封锁了通往巴洛维亚的道路。你们被迫踏入吸血鬼领主斯特拉德统治的黑暗国度，在恐惧、诱惑与信念之间寻找生路。',
  tags: ['D&D 5e', '哥特恐怖', '经典名作'],
  content:
    '玩家将作为外来冒险者进入巴洛维亚，调查不断出现的失踪与诅咒事件。冒险核心包含：探索诡异村镇、建立盟友关系、搜集圣物、直面斯特拉德的心理与力量压迫，并在绝望氛围中完成对抗。剧情强调抉择后果、人性考验、资源紧缺与阶段性目标推进。',
  finalGoal:
    '最终目标：在塔罗卡预言指引下，完成“三阶段破咒”——（1）集结至少两支关键盟友势力；（2）取得并净化三件核心圣物（破晓圣徽、日耀圣剑、圣者遗骨线索）；（3）攻入拉文洛夫特城堡完成多阶段突破并击败斯特拉德。若未满足前置条件，终局将进入失败或惨胜结局，并触发后续补救支线。',
  settingPrompt:
    `你是《龙与地下城：斯特拉德的诅咒》剧本的地下城主（DM）。

世界观总纲：
- 地点：巴洛维亚（Barovia），被黑暗迷雾封锁的半位面，所有道路最终都可能回到原点。
- 统治者：吸血鬼领主斯特拉德·冯·扎洛维奇（Strahd von Zarovich），既是暴君也是猎手。
- 核心冲突：求生与拯救、理性与迷信、牺牲与堕落。
- 叙事氛围：哥特恐怖、慢性压迫、道德困境、希望稀缺但始终存在微光。

历史与现状：
- 远古战争后，斯特拉德因执念与黑暗契约被诅咒，巴洛维亚被卷入迷雾。
- 居民长期处于恐惧统治：高税、失踪、梦魇侵蚀、宗教分裂、贵族与平民对立。
- 多数人已习得“沉默求生”，但地下仍有抵抗网络与秘密信仰。

关键阵营与地点（必须可互动）：
- 巴洛维亚村：绝望入口；核心议题是“保护脆弱者还是保存资源”。
- 瓦拉基：秩序表象下的政治高压；核心议题是“稳定优先还是揭露真相”。
- 科维亚斯特营地与酒馆网络：情报、交易、黑市、灰色盟约。
- 阿尔戈斯托尔特遗址：骑士旧誓与怨灵纠缠，关系到盟友线。
- 拉文洛夫特城堡：终局舞台，包含外城渗透、中庭博弈、内殿决战三层推进。

斯特拉德塑造要求：
- 不是单一“BOSS”，而是会观察、试探、离间、诱惑、惩戒的统治者。
- 保持“礼貌与残忍并存”：可赠礼、可宽恕、也可精准毁灭。
- 每次出场都要推动局势：制造抉择、改变关系、揭露弱点、扭曲希望。

叙事原则：
1) 每次推进必须给出“风险—代价—收益”三元关系。
2) NPC必须具备现实动机与立场，不得脸谱化。
3) 恐怖来源优先：环境异象、因果反噬、资源匮乏、未知信息，而非无意义血腥。
4) 战斗、探索、社交都要产出线索或局势变化。
5) 严格基于玩家已知事实推进，不得凭空添加破局神器。
6) 允许失败分支，但失败要带来新线索或可追补路径。

流程约束（最终目标驱动）：
- 主线终局必须指向“击败斯特拉德并打破迷雾诅咒”。
- 达成条件至少包含：关键盟友支持 + 圣物准备 + 城堡阶段性突破。
- 若任一条件不足，进入“失败/惨胜结局”，并生成后续可执行目标（如救回盟友、夺回圣物、重组补给线）。
- 每回合输出需提示当前主线进度（例：盟友 1/2，圣物 2/3，城堡突破 0/3）。`,
  opening: {
    enabled: true,
    initialState: {
      环境: {
        年: 735,
        月: 11,
        日: 3,
        时: 17,
        分: 40,
        星期: '雷',
        游戏天数: 1,
        当前回合: 1,
        大地点: '巴洛维亚',
        中地点: '斯瓦里奇树林',
        小地点: '旧斯瓦里奇路',
        具体地点: '迷雾道路与倒塌路碑',
        天气: {
          类型: '阴雨迷雾',
          强度: '中',
          结束时间: '0735:11:03:23:59'
        },
        场景标签: ['开局', '迷雾', '压迫感'],
        环境效果: [
          {
            名称: '迷雾压制',
            描述: '迷雾阻断远处视野，声音传播也出现失真。',
            效果: '远距离观察与追踪相关判定难度提高。',
            剩余回合: 3
          }
        ]
      },
      剧情: {
        当前章节: {
          章节ID: 'cos-ch1',
          序号: 1,
          标题: '第一章：迷雾初临',
          背景: '冒险者队伍被异常迷雾吞没，误入巴洛维亚边境，第一目标是确认安全落脚点并建立本地情报来源。',
          当前阶段: '进入巴洛维亚',
          目标: ['找到可供停留的安全据点', '接触第一位可信向导', '确认迷雾封锁规则'],
          失败条件: ['在未建立补给与情报前强行深入城堡区域', '队伍在第一夜出现失散且未重组']
        },
        主线目标: {
          最终目标: '击败斯特拉德并打破迷雾诅咒',
          当前进度: '盟友 0/2，圣物 0/3，城堡突破 0/3',
          阶段目标: [
            { 名称: '确定落脚点', 进度: '0/1', 状态: '进行中' },
            { 名称: '锁定第一条圣物线索', 进度: '0/1', 状态: '未开始' },
            { 名称: '建立第一位稳定盟友关系', 进度: '0/1', 状态: '未开始' }
          ]
        },
        当前回合总述: '',
        分组叙事: [],
        玩家行动提示: [],
        线索列表: [
          {
            线索ID: 'clue-tarokka',
            标题: '塔罗卡预言残片',
            内容: '传闻有一副能够指向破咒关键地点与关键人物的塔罗卡牌。',
            来源: '酒馆流言',
            状态: '未发现'
          },
          {
            线索ID: 'clue-church-bone',
            标题: '圣者遗骨线',
            内容: '巴洛维亚教会残留过可压制邪祟的圣骨记录。',
            来源: '旧抄本',
            状态: '未发现'
          }
        ],
        待触发事件: [
          {
            事件ID: 'evt-arrival-village',
            名称: '抵达巴洛维亚村',
            描述: '天黑前进入村庄将触发第一批可互动NPC与夜间危机。',
            触发条件: '玩家队伍推进至巴洛维亚村入口',
            失效条件: '第2回合结束仍未抵达村庄',
            状态: '待触发'
          }
        ],
        已发生事件: [],
        历史卷宗: []
      },
      任务列表: [
        {
          任务ID: 'task-main-001',
          标题: '在迷雾中找到今晚的庇护所',
          描述: '在夜幕彻底降临前进入可防守地点，并完成基础物资检查。',
          类型: '主线',
          发布者: '系统',
          发布地点: '旧斯瓦里奇路',
          推荐等级: '1-3',
          当前状态: '进行中',
          目标列表: [
            { 目标ID: 'obj-1', 描述: '抵达巴洛维亚村', 进度: 0, 目标值: 1, 状态: '未完成' },
            { 目标ID: 'obj-2', 描述: '确认安全落脚点', 进度: 0, 目标值: 1, 状态: '未完成' }
          ],
          奖励: { 经验: 120, 金币: 20, 物品: ['基础补给包'], 声望: 5 },
          截止时间: null,
          关联章节ID: 'cos-ch1',
          备注: '开局主线，失败会显著提高第一夜风险。'
        }
      ],
      约定列表: []
    },
    openingStory: {
      round: 1,
      publicLines: [
        { speaker: '公共旁白', text: '冰冷的雾墙在道路两端合拢，来路与去路一并消失。你们踏入了巴洛维亚。' },
        { speaker: '公共旁白', text: '雨丝打在残破路碑上，碑文被泥污遮去大半，只留下“村庄”一词仍可辨认。' },
        { speaker: '旁白', text: '夜色正在快速压下，林间偶有狼嚎，方向却始终无法判断。' }
      ],
      segments: [
        {
          groupId: 'opening-all',
          title: '【全员】迷雾中的邀请',
          lines: [
            { speaker: '旁白', text: '一盏马灯从前方雾中缓缓靠近，持灯的青年披着湿透的斗篷。' },
            { speaker: '伊斯马克', text: '陌生人，如果你们还想活着过夜，就跟我进村。别在路边逗留。' },
            { speaker: '旁白', text: '他说话时不断回头，像在提防某种会从雾里探出的东西。' },
            { speaker: '伊斯马克', text: '如果你们愿意帮忙，我会告诉你们这片土地真正的主人是谁。' }
          ]
        }
      ]
    }
  },
  roleTemplates: [
    {
      id: 'barovia-adventurer',
      name: '巴洛维亚冒险者模板',
      description: '用于《斯特拉德的诅咒》的基础捏人模板：固定属性加成 + 按属性限定分配点数。',
      allocationPointsByAttribute: {
        力量: 3,
        敏捷: 3,
        体质: 2,
        智力: 2,
        感知: 2,
        魅力: 2
      },
      baseAttributes: {
        力量: 8,
        敏捷: 8,
        体质: 8,
        智力: 8,
        感知: 8,
        魅力: 8
      },
      classOptions: [
        { id: 'class-paladin', name: '圣武士', description: '前线守护与圣光惩戒，擅长对抗邪祟。', attributeBonuses: { 力量: 2, 体质: 1 } },
        { id: 'class-ranger', name: '游侠', description: '追踪、侦查与远程压制，熟悉野外环境。', attributeBonuses: { 敏捷: 2, 感知: 1 } },
        { id: 'class-wizard', name: '法师', description: '奥术输出与知识解析，能够破解古老诅咒。', attributeBonuses: { 智力: 3 } },
        { id: 'class-rogue', name: '游荡者', description: '潜行、开锁与精确打击，擅长城堡渗透。', attributeBonuses: { 敏捷: 2, 魅力: 1 } },
        { id: 'class-cleric', name: '牧师', description: '神术支援与驱散不死，是队伍抗压核心。', attributeBonuses: { 感知: 2, 体质: 1 } },
        { id: 'class-bard', name: '吟游诗人', description: '社交操盘与战场辅助，可稳住士气。', attributeBonuses: { 魅力: 2, 敏捷: 1 } },
        { id: 'class-fighter', name: '战士', description: '稳健耐久的武装专家，适合正面推进。', attributeBonuses: { 力量: 2, 体质: 2 } },
        { id: 'class-warlock', name: '术士（邪契）', description: '高风险高回报的黑暗施法者，代价与力量并存。', attributeBonuses: { 魅力: 2, 智力: 1 } },
        { id: 'class-druid', name: '德鲁伊', description: '自然秘术与形态变化，可稳定补给与侦查。', attributeBonuses: { 感知: 2, 智力: 1 } },
        { id: 'class-barbarian', name: '野蛮人', description: '狂暴突击与高生存，适合破阵与掩护。', attributeBonuses: { 力量: 2, 体质: 2 } },
        { id: 'class-monk', name: '武僧', description: '高机动与精准控制，擅长短兵压制。', attributeBonuses: { 敏捷: 2, 感知: 1 } },
        { id: 'class-artificer', name: '工匠师', description: '炼金与机关改造，擅长处理诅咒装置。', attributeBonuses: { 智力: 2, 敏捷: 1 } }
      ],
      genderOptions: [
        { id: 'gender-male', name: '男性', description: '传统体格构成。', attributeBonuses: { 力量: 1 } },
        { id: 'gender-female', name: '女性', description: '灵巧敏锐构成。', attributeBonuses: { 敏捷: 1 } },
        { id: 'gender-nonbinary', name: '非二元', description: '意志与适应力表现突出。', attributeBonuses: { 感知: 1 } }
      ],
      raceOptions: [
        { id: 'race-human', name: '人类', description: '适应力均衡，学习速度快。', attributeBonuses: { 力量: 1, 感知: 1 } },
        { id: 'race-half-elf', name: '半精灵', description: '感知与社交兼具，擅长协商。', attributeBonuses: { 感知: 1, 魅力: 2 } },
        { id: 'race-tiefling', name: '提夫林', description: '天生奥术痕印，对黑暗力量有抗性。', attributeBonuses: { 智力: 2, 魅力: 1 } },
        { id: 'race-halfling', name: '轻足半身人', description: '机动与隐匿专家，危机中更冷静。', attributeBonuses: { 敏捷: 2, 魅力: 1 } },
        { id: 'race-dwarf', name: '山地矮人', description: '强韧顽强，适合前排硬抗。', attributeBonuses: { 体质: 2, 力量: 1 } },
        { id: 'race-elf', name: '木精灵', description: '感官敏锐、行动迅捷。', attributeBonuses: { 敏捷: 2, 感知: 1 } },
        { id: 'race-half-orc', name: '半兽人', description: '爆发力与威慑力强，适合压制敌阵。', attributeBonuses: { 力量: 2, 体质: 1 } },
        { id: 'race-gnome', name: '侏儒', description: '思维敏捷，擅长机关与幻术识破。', attributeBonuses: { 智力: 2, 敏捷: 1 } },
        { id: 'race-dragonborn', name: '龙裔', description: '血脉意志坚定，兼具威慑与抗压。', attributeBonuses: { 力量: 2, 魅力: 1 } },
        { id: 'race-aasimar', name: '亚斯玛', description: '神圣血统稀薄传承，对邪祟更敏感。', attributeBonuses: { 魅力: 2, 感知: 1 } }
      ],
      backgroundOptions: [
        { id: 'bg-soldier', name: '老兵', description: '战阵经验丰富，擅长队形与防守推进。', attributeBonuses: { 体质: 1, 力量: 1 } },
        { id: 'bg-scholar', name: '学者', description: '考据、语言与推理能力强。', attributeBonuses: { 智力: 2 } },
        { id: 'bg-outlander', name: '荒野流民', description: '野外生存与追踪，补给管理能力突出。', attributeBonuses: { 感知: 1, 体质: 1 } },
        { id: 'bg-urchin', name: '街巷孤儿', description: '应变、潜行与人情网。', attributeBonuses: { 敏捷: 1, 魅力: 1 } },
        { id: 'bg-acolyte', name: '侍僧', description: '宗教知识与仪式经验，对邪祟有判断力。', attributeBonuses: { 感知: 2 } },
        { id: 'bg-hunter', name: '怪物猎人', description: '针对异怪的专业训练与痕迹分析能力。', attributeBonuses: { 敏捷: 1, 智力: 1 } },
        { id: 'bg-noble-exile', name: '流亡贵族', description: '礼仪、谈判与权谋直觉。', attributeBonuses: { 魅力: 2 } },
        { id: 'bg-gravekeeper', name: '守墓人', description: '熟悉亡者仪式与墓园秘道。', attributeBonuses: { 感知: 1, 体质: 1 } },
        { id: 'bg-inquisitor', name: '审判官学徒', description: '擅长盘问与辨谎，对异端线索敏锐。', attributeBonuses: { 智力: 1, 魅力: 1 } },
        { id: 'bg-caravan-guard', name: '商队护卫', description: '长途护送经验，警戒与应急能力优秀。', attributeBonuses: { 力量: 1, 感知: 1 } },
        { id: 'bg-occult-survivor', name: '秘教幸存者', description: '经历禁忌仪式后仍存活，意志顽强。', attributeBonuses: { 感知: 1, 魅力: 1 } },
        { id: 'bg-apothecary', name: '草药师', description: '懂得药剂与毒理，可处理基础伤病。', attributeBonuses: { 智力: 1, 体质: 1 } }
      ],
      starterItemOptions: [
        { id: 'item-longsword', name: '长剑', description: '近战基础武器', item: { 物品ID: 'item-longsword', 类型: '武器', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 3.2, 价值: 60, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: '主手', 使用效果: ['近战攻击'], 标签: ['开局', '武器'] } },
        { id: 'item-shield', name: '徽记盾牌', description: '提高防护能力', item: { 物品ID: 'item-shield', 类型: '防具', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 4.5, 价值: 50, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: '副手', 使用效果: ['提升防护'], 标签: ['开局', '防具'] } },
        { id: 'item-bow', name: '长弓', description: '远程输出武器', item: { 物品ID: 'item-bow', 类型: '武器', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 2.4, 价值: 70, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: '主手', 使用效果: ['远程攻击'], 标签: ['开局', '武器'] } },
        { id: 'item-dagger', name: '匕首', description: '轻便副武器', item: { 物品ID: 'item-dagger', 类型: '武器', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 0.7, 价值: 20, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: '副手', 使用效果: ['近战攻击'], 标签: ['开局', '武器'] } },
        { id: 'item-holy-water', name: '祝福圣水', description: '对亡灵与邪祟有效', item: { 物品ID: 'item-holy-water', 类型: '消耗品', 品质: '优良', 数量: 1, 是否可堆叠: true, 重量: 0.5, 价值: 80, 当前耐久: 1, 最大耐久: 1, 可用次数: 1, 装备槽位: null, 使用效果: ['对邪祟造成额外效果'], 标签: ['开局', '圣属性'] } },
        { id: 'item-herb-pack', name: '草药包', description: '基础治疗与止血', item: { 物品ID: 'item-herb-pack', 类型: '消耗品', 品质: '普通', 数量: 1, 是否可堆叠: true, 重量: 0.8, 价值: 25, 当前耐久: 1, 最大耐久: 1, 可用次数: 1, 装备槽位: null, 使用效果: ['恢复少量生命值'], 标签: ['开局', '治疗'] } },
        { id: 'item-thief-tools', name: '盗贼工具', description: '开锁与拆解机关', item: { 物品ID: 'item-thief-tools', 类型: '工具', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 1.1, 价值: 45, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: null, 使用效果: ['开锁判定加值'], 标签: ['开局', '工具'] } },
        { id: 'item-scroll-detect', name: '侦测卷轴', description: '侦测异常魔法痕迹', item: { 物品ID: 'item-scroll-detect', 类型: '卷轴', 品质: '优良', 数量: 1, 是否可堆叠: true, 重量: 0.2, 价值: 65, 当前耐久: 1, 最大耐久: 1, 可用次数: 1, 装备槽位: null, 使用效果: ['侦测异常魔法'], 标签: ['开局', '法术'] } },
        { id: 'item-silver-dust', name: '银粉包', description: '克制部分诅咒与不死', item: { 物品ID: 'item-silver-dust', 类型: '材料', 品质: '优良', 数量: 1, 是否可堆叠: true, 重量: 0.3, 价值: 55, 当前耐久: 1, 最大耐久: 1, 可用次数: 1, 装备槽位: null, 使用效果: ['用于净化或仪式'], 标签: ['开局', '材料'] } },
        { id: 'item-torch-kit', name: '火把套组', description: '照明与驱赶低阶生物', item: { 物品ID: 'item-torch-kit', 类型: '工具', 品质: '普通', 数量: 1, 是否可堆叠: true, 重量: 1.5, 价值: 15, 当前耐久: 3, 最大耐久: 3, 可用次数: 3, 装备槽位: null, 使用效果: ['提供照明'], 标签: ['开局', '探索'] } },
        { id: 'item-chain', name: '铁链与锁扣', description: '拘束/攀爬/固定用途', item: { 物品ID: 'item-chain', 类型: '工具', 品质: '普通', 数量: 1, 是否可堆叠: false, 重量: 3.6, 价值: 35, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: null, 使用效果: ['固定或拘束目标'], 标签: ['开局', '工具'] } },
        { id: 'item-prayer-icon', name: '祈祷圣像', description: '仪式专注媒介', item: { 物品ID: 'item-prayer-icon', 类型: '圣物', 品质: '优良', 数量: 1, 是否可堆叠: false, 重量: 0.4, 价值: 75, 当前耐久: 100, 最大耐久: 100, 可用次数: 999, 装备槽位: '饰品', 使用效果: ['提升仪式专注'], 标签: ['开局', '圣物'] } }
      ],
      maxStarterItems: 4
    }
  ]
};
