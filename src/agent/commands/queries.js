import * as world from '../library/world.js';
import * as mc from '../../utils/mcdata.js';
import { getCommandDocs } from './index.js';
import convoManager from '../conversation.js';
import { load } from 'cheerio';

const pad = (str) => {
    return '\n' + str + '\n';
}

// queries are commands that just return strings and don't affect anything in the world
export const queryList = [
    {
        name: "!stats",
        description: "Get your bot's location, health, hunger, and time of day.", 
        perform: function (agent) {
            let bot = agent.bot;
            let res = '状态';
            let pos = bot.entity.position;
            // display position to 2 decimal places
            res += `\n- 位置: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
            // Gameplay
            res += `\n- 游戏模式: ${bot.game.gameMode}`;
            res += `\n- 生命值: ${Math.round(bot.health)} / 20`;
            res += `\n- 饥饿值: ${Math.round(bot.food)} / 20`;
            res += `\n- 生物群系: ${world.getBiomeName(bot)}`;
            let weather = "晴朗";
            if (bot.rainState > 0)
                weather = "下雨";
            if (bot.thunderState > 0)
                weather = "雷暴";
            res += `\n- 天气: ${weather}`;
            // let block = bot.blockAt(pos);
            // res += `\n- Artficial light: ${block.skyLight}`;
            // res += `\n- Sky light: ${block.light}`;
            // light properties are bugged, they are not accurate
            res += '\n- ' + world.getSurroundingBlocks(bot).join('\n- ')
            res += `\n- 头顶上方第一个实体方块: ${world.getFirstBlockAboveHead(bot, null, 32)}`;


            if (bot.time.timeOfDay < 6000) {
                res += '\n- 时间: 早晨';
            } else if (bot.time.timeOfDay < 12000) {
                res += '\n- 时间: 下午';
            } else {
                res += '\n- 时间: 夜晚';
            }

            // get the bot's current action
            let action = agent.actions.currentActionLabel;
            if (agent.isIdle())
                action = '空闲';
            res += `\n- 当前行动: ${action}`;


            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            res += '\n- 附近的玩家: ' + (players.length > 0 ? players.join(', ') : '无');
            res += '\n- 附近的机器人: ' + (bots.length > 0 ? bots.join(', ') : '无');

            res += '\n' + agent.bot.modes.getMiniDocs() + '\n';
            return pad(res);
        }
    },
    {
        name: "!inventory",
        description: "Get your bot's inventory.",
        perform: function (agent) {
            let bot = agent.bot;
            let inventory = world.getInventoryCounts(bot);
            let res = '物品栏';
            for (const item in inventory) {
                if (inventory[item] && inventory[item] > 0)
                    res += `\n- ${item}: ${inventory[item]}`;
            }
            if (res === '物品栏') {
                res += ': 空';
            }
            else if (agent.bot.game.gameMode === 'creative') {
                res += '\n(你在创造模式下拥有无限物品。不需要收集资源！)';
            }

            let helmet = bot.inventory.slots[5];
            let chestplate = bot.inventory.slots[6];
            let leggings = bot.inventory.slots[7];
            let boots = bot.inventory.slots[8];
            res += '\n装备: ';
            if (helmet)
                res += `\n头部: ${helmet.name}`;
            if (chestplate)
                res += `\n胸部: ${chestplate.name}`;
            if (leggings)
                res += `\n腿部: ${leggings.name}`;
            if (boots)
                res += `\n脚部: ${boots.name}`;
            if (!helmet && !chestplate && !leggings && !boots)
                res += '无';

            return pad(res);
        }
    },
    {
        name: "!nearbyBlocks",
        description: "Get the blocks near the bot.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = '附近方块';
            let blocks = world.getNearbyBlockTypes(bot);
            for (let i = 0; i < blocks.length; i++) {
                res += `\n- ${blocks[i]}`;
            }
            if (blocks.length == 0) {
                res += ': 无';
            } 
            else {
                // Environmental Awareness
                res += '\n- ' + world.getSurroundingBlocks(bot).join('\n- ')
                res += `\n- 头顶上方第一个实体方块: ${world.getFirstBlockAboveHead(bot, null, 32)}`;
            }
            return pad(res);
        }
    },
    {
        name: "!craftable",
        description: "Get the craftable items with the bot's inventory.",
        perform: function (agent) {
            let craftable = world.getCraftableItems(agent.bot);
            let res = '可合成物品';
            for (const item of craftable) {
                res += `\n- ${item}`;
            }
            if (res == '可合成物品') {
                res += ': 无';
            }
            return pad(res);
        }
    },
    {
        name: "!entities",
        description: "Get the nearby players and entities.",
        perform: function (agent) {
            let bot = agent.bot;
            let res = '附近实体';
            let players = world.getNearbyPlayerNames(bot);
            let bots = convoManager.getInGameAgents().filter(b => b !== agent.name);
            players = players.filter(p => !bots.includes(p));

            for (const player of players) {
                res += `\n- 玩家: ${player}`;
            }
            for (const bot of bots) {
                res += `\n- 机器人: ${bot}`;
            }

            for (const entity of world.getNearbyEntityTypes(bot)) {
                if (entity === 'player' || entity === 'item')
                    continue;
                res += `\n- 实体: ${entity}`;
            }
            if (res == '附近实体') {
                res += ': 无';
            }
            return pad(res);
        }
    },
    {
        name: "!modes",
        description: "Get all available modes and their docs and see which are on/off.",
        perform: function (agent) {
            return agent.bot.modes.getDocs();
        }
    },
    {
        name: '!savedPlaces',
        description: 'List all saved locations.',
        perform: async function (agent) {
            return "已保存的位置名称: " + agent.memory_bank.getKeys();
        }
    },
    {
        name: '!getCraftingPlan',
        description: "Provides a comprehensive crafting plan for a specified item. This includes a breakdown of required ingredients, the exact quantities needed, and an analysis of missing ingredients or extra items needed based on the bot's current inventory.",
        params: {
            targetItem: { 
                type: 'string', 
                description: 'The item that we are trying to craft' 
            },
            quantity: { 
                type: 'int',
                description: 'The quantity of the item that we are trying to craft',
                optional: true,
                domain: [1, Infinity, '[)'], // Quantity must be at least 1,
                default: 1
            }
        },
        perform: function (agent, targetItem, quantity = 1) {
            let bot = agent.bot;

            // Fetch the bot's inventory
            const curr_inventory = world.getInventoryCounts(bot); 
            const target_item = targetItem;
            let existingCount = curr_inventory[target_item] || 0;
            let prefixMessage = '';
            if (existingCount > 0) {
                curr_inventory[target_item] -= existingCount;
                prefixMessage = `你的物品栏中已有 ${existingCount} 个 ${target_item}。如果你需要制作更多，\n`;
            }

            // Generate crafting plan
            let craftingPlan = mc.getDetailedCraftingPlan(target_item, quantity, curr_inventory);
            craftingPlan = prefixMessage + craftingPlan;
            return pad(craftingPlan);
        },
    },
    {
        name: '!searchWiki',
        description: 'Search the Minecraft Wiki for the given query.',
        params: {
            'query': { type: 'string', description: 'The query to search for.' }
        },
        perform: async function (agent, query) {
            const url = `https://minecraft.wiki/w/${query}`
            try {
                const response = await fetch(url);
                if (response.status === 404) {
                  return `在 Minecraft Wiki 中未找到 ${query}。请尝试调整搜索词。`;
                }
                const html = await response.text();
                const $ = load(html);
            
                const parserOutput = $("div.mw-parser-output");
                
                parserOutput.find("table.navbox").remove();

                const divContent = parserOutput.text();
            
                return divContent.trim();
              } catch (error) {
                console.error("Error fetching or parsing HTML:", error);
                return `发生以下错误: ${error}`
              }
        }
    },
    {
        name: '!help',
        description: 'Lists all available commands and their descriptions.',
        perform: async function (agent) {
            return getCommandDocs();
        }
    },
];
