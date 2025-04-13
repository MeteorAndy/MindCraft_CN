import { History } from './history.js';
import { Coder } from './coder.js';
import { VisionInterpreter } from './vision/vision_interpreter.js';
import { Prompter } from '../models/prompter.js';
import { initModes } from './modes.js';
import { initBot } from '../utils/mcdata.js';
import { containsCommand, commandExists, executeCommand, truncCommandMessage, isAction, blacklistCommands } from './commands/index.js';
import { ActionManager } from './action_manager.js';
import { NPCContoller } from './npc/controller.js';
import { MemoryBank } from './memory_bank.js';
import { SelfPrompter } from './self_prompter.js';
import convoManager from './conversation.js';
import { addBrowserViewer } from './vision/browser_viewer.js';
import settings from '../../settings.js';
import { serverProxy } from './agent_proxy.js';
import { Task } from './tasks.js';
import { say } from './speak.js';

export class Agent {
    async start(profile_fp, load_mem=false, init_message=null, count_id=0, task_path=null, task_id=null) {
        this.last_sender = null;
        this.count_id = count_id;
        if (!profile_fp) {
            throw new Error('没有提供配置文件路径');
        }
        
        console.log('正在使用配置文件初始化代理:', profile_fp);
        
        // Initialize components with more detailed error handling
        console.log('正在初始化动作管理器...');
        this.actions = new ActionManager(this);
        console.log('正在初始化提示器...');
        this.prompter = new Prompter(this, profile_fp);
        this.name = this.prompter.getName();
        console.log('正在初始化历史记录...');
        this.history = new History(this);
        console.log('正在初始化代码器...');
        this.coder = new Coder(this);
        console.log('正在初始化NPC控制器...');
        this.npc = new NPCContoller(this);
        console.log('正在初始化记忆库...');
        this.memory_bank = new MemoryBank();
        console.log('正在初始化自我提示器...');
        this.self_prompter = new SelfPrompter(this);
        convoManager.initAgent(this);            
        console.log('正在初始化示例...');
        await this.prompter.initExamples();
        console.log('正在初始化任务...');
        this.task = new Task(this, task_path, task_id);
        const blocked_actions = settings.blocked_actions.concat(this.task.blocked_actions || []);
        blacklistCommands(blocked_actions);

        serverProxy.connect(this);

        console.log(this.name, '正在登录Minecraft...');
        this.bot = initBot(this.name);

        initModes(this);

        let save_data = null;
        if (load_mem) {
            save_data = this.history.load();
        }

        this.bot.on('login', () => {
            console.log(this.name, '已登录！');

            serverProxy.login();
            
            // Set skin for profile, requires Fabric Tailor. (https://modrinth.com/mod/fabrictailor)
            if (this.prompter.profile.skin)
                this.bot.chat(`/skin set URL ${this.prompter.profile.skin.model} ${this.prompter.profile.skin.path}`);
            else
                this.bot.chat(`/skin clear`);
        });

        const spawnTimeout = setTimeout(() => {
            process.exit(0);
        }, 30000);
        this.bot.once('spawn', async () => {
            try {
                clearTimeout(spawnTimeout);
                addBrowserViewer(this.bot, count_id);

                // wait for a bit so stats are not undefined
                await new Promise((resolve) => setTimeout(resolve, 1000));
                
                console.log(`${this.name} 已生成。`);
                this.clearBotLogs();

                this._setupEventHandlers(save_data, init_message);
                this.startEvents();

                if (!load_mem) {
                    this.task.initBotTask();
                }

                console.log('正在初始化视觉解释器...');
                this.vision_interpreter = new VisionInterpreter(this, settings.allow_vision);

            } catch (error) {
                console.error('生成事件出错:', error);
                process.exit(0);
            }
        });
    }

    async _setupEventHandlers(save_data, init_message) {
        const ignore_messages = [
            "设置游戏模式为",
            "设置时间为", 
            "设置难度为",
            "传送",
            "设置天气为",
            "游戏规则"
        ];
        
        const respondFunc = async (username, message) => {
            if (username === this.name) return;
            if (settings.only_chat_with.length > 0 && !settings.only_chat_with.includes(username)) return;
            try {
                if (ignore_messages.some((m) => message.startsWith(m))) return;

                this.shut_up = false;

                console.log(this.name, '收到来自', username, '的消息:', message);

                if (convoManager.isOtherAgent(username)) {
                    console.warn('收到其他机器人的私聊??')
                }
                else {
                    this.handleMessage(username, message);
                }
            } catch (error) {
                console.error('处理消息时出错:', error);
            }
        }
		
		this.respondFunc = respondFunc

        this.bot.on('whisper', respondFunc);
        if (settings.profiles.length === 1)
            this.bot.on('chat', respondFunc);

        // Set up auto-eat
        this.bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ["腐肉", "蜘蛛眼", "毒马铃薯", "河豚", "生鸡肉"]
        };

        if (save_data?.self_prompt) {
            if (init_message) {
                this.history.add('system', init_message);
            }
            await this.self_prompter.handleLoad(save_data.self_prompt, save_data.self_prompting_state);
        }
        if (save_data?.last_sender) {
            this.last_sender = save_data.last_sender;
            if (convoManager.otherAgentInGame(this.last_sender)) {
                const msg_package = {
                    message: `你已重新启动，这是自动生成的消息。请继续与我对话。`,
                    start: true
                };
                convoManager.receiveFromBot(this.last_sender, msg_package);
            }
        }
        else if (init_message) {
            await this.handleMessage('system', init_message, 2);
        }
        else {
            this.openChat("你好世界！我是 "+this.name);
        }
    }

    requestInterrupt() {
        this.bot.interrupt_code = true;
        this.bot.stopDigging();
        this.bot.collectBlock.cancelTask();
        this.bot.pathfinder.stop();
        this.bot.pvp.stop();
    }

    clearBotLogs() {
        this.bot.output = '';
        this.bot.interrupt_code = false;
    }

    shutUp() {
        this.shut_up = true;
        if (this.self_prompter.isActive()) {
            this.self_prompter.stop(false);
        }
        convoManager.endAllConversations();
    }

    async handleMessage(source, message, max_responses=null) {
        if (!source || !message) {
            console.warn('收到来自', source, '的空消息');
            return false;
        }

        let used_command = false;
        if (max_responses === null) {
            max_responses = settings.max_commands === -1 ? Infinity : settings.max_commands;
        }
        if (max_responses === -1) {
            max_responses = Infinity;
        }

        const self_prompt = source === 'system' || source === this.name;
        const from_other_bot = convoManager.isOtherAgent(source);

        if (!self_prompt && !from_other_bot) { // from user, check for forced commands
            const user_command_name = containsCommand(message);
            if (user_command_name) {
                if (!commandExists(user_command_name)) {
                    this.routeResponse(source, `命令 '${user_command_name}' 不存在。`);
                    return false;
                }
                this.routeResponse(source, `*${source} 使用了 ${user_command_name.substring(1)}*`);
                if (user_command_name === '!newAction') {
                    // all user-initiated commands are ignored by the bot except for this one
                    // add the preceding message to the history to give context for newAction
                    this.history.add(source, message);
                }
                let execute_res = await executeCommand(this, message);
                if (execute_res) 
                    this.routeResponse(source, execute_res);
                return true;
            }
        }

        if (from_other_bot)
            this.last_sender = source;

        console.log('收到来自', source, '的消息:', message);

        const checkInterrupt = () => this.self_prompter.shouldInterrupt(self_prompt) || this.shut_up || convoManager.responseScheduledFor(source);
        
        let behavior_log = this.bot.modes.flushBehaviorLog().trim();
        if (behavior_log.length > 0) {
            const MAX_LOG = 500;
            if (behavior_log.length > MAX_LOG) {
                behavior_log = '...' + behavior_log.substring(behavior_log.length - MAX_LOG);
            }
            behavior_log = '最近的行为日志: \n' + behavior_log;
            await this.history.add('system', behavior_log);
        }

        // Handle other user messages
        await this.history.add(source, message);
        this.history.save();

        if (!self_prompt && this.self_prompter.isActive()) // message is from user during self-prompting
            max_responses = 1; // force only respond to this message, then let self-prompting take over
        for (let i=0; i<max_responses; i++) {
            if (checkInterrupt()) break;
            let history = this.history.getHistory();
            let res = await this.prompter.promptConvo(history);

            console.log(`${this.name} 对 ${source} 的完整回复: ""${res}""`);
            
            if (res.trim().length === 0) { 
                console.warn('没有回复')
                break; // empty response ends loop
            }

            let command_name = containsCommand(res);

            if (command_name) { // contains query or command
                res = truncCommandMessage(res); // everything after the command is ignored
                this.history.add(this.name, res);
                
                if (!commandExists(command_name)) {
                    this.history.add('system', `命令 ${command_name} 不存在。`);
                    console.warn('代理幻想出了命令:', command_name)
                    continue;
                }

                if (checkInterrupt()) break;
                this.self_prompter.handleUserPromptedCmd(self_prompt, isAction(command_name));

                if (settings.verbose_commands) {
                    this.routeResponse(source, res);
                }
                else { // only output command name
                    let pre_message = res.substring(0, res.indexOf(command_name)).trim();
                    let chat_message = `*使用了 ${command_name.substring(1)}*`;
                    if (pre_message.length > 0)
                        chat_message = `${pre_message}  ${chat_message}`;
                    this.routeResponse(source, chat_message);
                }

                let execute_res = await executeCommand(this, res);

                console.log('代理执行了:', command_name, '并得到:', execute_res);
                used_command = true;

                if (execute_res)
                    this.history.add('system', execute_res);
                else
                    break;
            }
            else { // conversation response
                this.history.add(this.name, res);
                this.routeResponse(source, res);
                break;
            }
            
            this.history.save();
        }

        return used_command;
    }

    async routeResponse(to_player, message) {
        if (this.shut_up) return;
        let self_prompt = to_player === 'system' || to_player === this.name;
        if (self_prompt && this.last_sender) {
            // this is for when the agent is prompted by system while still in conversation
            // so it can respond to events like death but be routed back to the last sender
            to_player = this.last_sender;
        }

        if (convoManager.isOtherAgent(to_player) && convoManager.inConversation(to_player)) {
            // if we're in an ongoing conversation with the other bot, send the response to it
            convoManager.sendToBot(to_player, message);
        }
        else {
            // otherwise, use open chat
            this.openChat(message);
            // note that to_player could be another bot, but if we get here the conversation has ended
        }
    }

    async openChat(message) {
        let to_translate = message;
        let remaining = '';
        let command_name = containsCommand(message);
        let translate_up_to = command_name ? message.indexOf(command_name) : -1;
        if (translate_up_to != -1) { // don't translate the command
            to_translate = to_translate.substring(0, translate_up_to);
            remaining = message.substring(translate_up_to);
        }
        message = to_translate.trim() + " " + remaining;
        // newlines are interpreted as separate chats, which triggers spam filters. replace them with spaces
        message = message.replaceAll('\n', ' ');

        if (settings.only_chat_with.length > 0) {
            for (let username of settings.only_chat_with) {
                this.bot.whisper(username, message);
            }
        }
        else {
	    if (settings.speak) {
            say(to_translate);
	    }
            this.bot.chat(message);
        }
    }

    startEvents() {
        // Custom events
        this.bot.on('time', () => {
            if (this.bot.time.timeOfDay == 0)
            this.bot.emit('sunrise');
            else if (this.bot.time.timeOfDay == 6000)
            this.bot.emit('noon');
            else if (this.bot.time.timeOfDay == 12000)
            this.bot.emit('sunset');
            else if (this.bot.time.timeOfDay == 18000)
            this.bot.emit('midnight');
        });

        let prev_health = this.bot.health;
        this.bot.lastDamageTime = 0;
        this.bot.lastDamageTaken = 0;
        this.bot.on('health', () => {
            if (this.bot.health < prev_health) {
                this.bot.lastDamageTime = Date.now();
                this.bot.lastDamageTaken = prev_health - this.bot.health;
            }
            prev_health = this.bot.health;
        });
        // Logging callbacks
        this.bot.on('error' , (err) => {
            console.error('错误事件!', err);
        });
        this.bot.on('end', (reason) => {
            console.warn('机器人断开连接！正在终止代理进程。', reason)
            this.cleanKill('机器人断开连接！正在终止代理进程。');
        });
        this.bot.on('death', () => {
            this.actions.cancelResume();
            this.actions.stop();
        });
        this.bot.on('kicked', (reason) => {
            console.warn('机器人被踢出!', reason);
            this.cleanKill('机器人被踢出！正在终止代理进程。');
        });
        this.bot.on('messagestr', async (message, _, jsonMsg) => {
            if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(this.name)) {
                console.log('代理死亡: ', message);
                let death_pos = this.bot.entity.position;
                this.memory_bank.rememberPlace('last_death_position', death_pos.x, death_pos.y, death_pos.z);
                let death_pos_text = null;
                if (death_pos) {
                    death_pos_text = `x坐标: ${death_pos.x.toFixed(2)}, y坐标: ${death_pos.y.toFixed(2)}, z坐标: ${death_pos.x.toFixed(2)}`;
                }
                let dimention = this.bot.game.dimension;
                this.handleMessage('system', `你在 ${dimention} 维度的 ${death_pos_text || "未知"} 位置死亡，最后的消息是: '${message}'。你的死亡位置已保存为 'last_death_position'，如果你想返回的话。之前的动作已停止，你已重生。`);
            }
        });
        this.bot.on('idle', () => {
            this.bot.clearControlStates();
            this.bot.pathfinder.stop(); // clear any lingering pathfinder
            this.bot.modes.unPauseAll();
            this.actions.resumeAction();
        });

        // Init NPC controller
        this.npc.init();

        // This update loop ensures that each update() is called one at a time, even if it takes longer than the interval
        const INTERVAL = 300;
        let last = Date.now();
        setTimeout(async () => {
            while (true) {
                let start = Date.now();
                await this.update(start - last);
                let remaining = INTERVAL - (Date.now() - start);
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                last = start;
            }
        }, INTERVAL);

        this.bot.emit('idle');
    }

    async update(delta) {
        await this.bot.modes.update();
        this.self_prompter.update(delta);
        if (this.task.data) {
            let res = this.task.isDone();
            if (res) {
                await this.history.add('system', `${res.message} 以代码 ${res.code} 结束`);
                await this.history.save();
                console.log('任务完成:', res.message);
                this.killAll();
            }
        }
    }

    isIdle() {
        return !this.actions.executing;
    }
    
    cleanKill(msg='正在终止代理进程...', code=1) {
        this.history.add('system', msg);
        this.bot.chat(code > 1 ? '正在重启。': '正在退出。');
        this.history.save();
        process.exit(code);
    }

    killAll() {
        serverProxy.shutdown();
    }
}
