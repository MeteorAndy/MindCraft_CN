import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Module-level variables
let io;
let server;
const registeredAgents = new Set();
const inGameAgents = {};
const agentManagers = {}; // socket for main process that registers/controls agents

// Initialize the server
export function createMindServer(port = 8080) {
    const app = express();
    server = http.createServer(app);
    io = new Server(server);

    // Serve static files
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.join(__dirname, 'public')));

    // Socket.io connection handling
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('客户端已连接');

        agentsUpdate(socket);

        socket.on('register-agents', (agentNames) => {
            console.log(`正在注册代理: ${agentNames}`);
            agentNames.forEach(name => registeredAgents.add(name));
            for (let name of agentNames) {
                agentManagers[name] = socket;
            }
            socket.emit('register-agents-success');
            agentsUpdate();
        });

        socket.on('login-agent', (agentName) => {
            if (curAgentName && curAgentName !== agentName) {
                console.warn(`代理 ${agentName} 已经以 ${curAgentName} 的身份登录`);
                return;
            }
            if (registeredAgents.has(agentName)) {
                curAgentName = agentName;
                inGameAgents[agentName] = socket;
                agentsUpdate();
            } else {
                console.warn(`代理 ${agentName} 未注册`);
            }
        });

        socket.on('logout-agent', (agentName) => {
            if (inGameAgents[agentName]) {
                delete inGameAgents[agentName];
                agentsUpdate();
            }
        });

        socket.on('disconnect', () => {
            console.log('客户端已断开连接');
            if (inGameAgents[curAgentName]) {
                delete inGameAgents[curAgentName];
                agentsUpdate();
            }
        });

        socket.on('chat-message', (agentName, json) => {
            if (!inGameAgents[agentName]) {
                console.warn(`代理 ${agentName} 尝试发送消息但未登录`);
                return;
            }
            console.log(`${curAgentName} 正在向 ${agentName} 发送消息: ${json.message}`);
            inGameAgents[agentName].emit('chat-message', curAgentName, json);
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`正在重启代理: ${agentName}`);
            inGameAgents[agentName].emit('restart-agent');
        });

        socket.on('stop-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('stop-agent', agentName);
            }
            else {
                console.warn(`正在停止未注册的代理 ${agentName}`);
            }
        });

        socket.on('start-agent', (agentName) => {
            let manager = agentManagers[agentName];
            if (manager) {
                manager.emit('start-agent', agentName);
            }
            else {
                console.warn(`正在启动未注册的代理 ${agentName}`);
            }
        });

        socket.on('stop-all-agents', () => {
            console.log('正在终止所有代理');
            stopAllAgents();
        });

        socket.on('shutdown', () => {
            console.log('正在关闭');
            for (let manager of Object.values(agentManagers)) {
                manager.emit('shutdown');
            }
            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });

        socket.on('send-message', (agentName, message) => {
            if (!inGameAgents[agentName]) {
                console.warn(`代理 ${agentName} 未登录，无法通过MindServer发送消息`);
                return
            }
            try {
                console.log(`正在向代理 ${agentName} 发送消息: ${message}`);
                inGameAgents[agentName].emit('send-message', agentName, message)
            } catch (error) {
                console.error('错误: ', error);
            }
        });
    });

    server.listen(port, 'localhost', () => {
        console.log(`MindServer正在端口 ${port} 上运行`);
    });

    return server;
}

function agentsUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    registeredAgents.forEach(name => {
        agents.push({name, in_game: !!inGameAgents[name]});
    });
    socket.emit('agents-update', agents);
}

function stopAllAgents() {
    for (const agentName in inGameAgents) {
        let manager = agentManagers[agentName];
        if (manager) {
            manager.emit('stop-agent', agentName);
        }
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const getConnectedAgents = () => connectedAgents;
