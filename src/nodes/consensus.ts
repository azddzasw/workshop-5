import { BASE_NODE_PORT } from '../config';
import http from 'http';

// 启动所有节点
export async function startConsensus(N: number) {
  for (let index = 0; index < N; index++) {
    await sendHttpRequest(`http://localhost:${BASE_NODE_PORT + index}/start`);
  }
}

// 停止所有节点
export async function stopConsensus(N: number) {
  for (let index = 0; index < N; index++) {
    await sendHttpRequest(`http://localhost:${BASE_NODE_PORT + index}/stop`);
  }
}

// Ben-Or 共识算法
export async function benOrConsensus(port: number, N: number) {
  let decision: number | null = null;
  let value: number | null = null;

  // 随机选择一个值
  value = Math.random() > 0.5 ? 1 : 0;

  for (let round = 0; round < Math.log2(N); round++) {
    // 发送值给所有节点
    await broadcastMessage(port, `value/${value}`);

    // 接收其他节点的值
    const responses = [];
    for (let index = 0; index < N; index++) {
      if (index !== port - BASE_NODE_PORT) {
        const response = await sendHttpRequest(`http://localhost:${BASE_NODE_PORT + index}/receive`);
        responses.push(JSON.parse(response).value);
      }
    }

    // 更新决策
    const sum = responses.reduce((acc, val) => acc + val, 0);
    decision = sum > N / 2 ? 1 : 0;

    // 更新值
    if (decision === 1) {
      value = 1;
    }
  }

  // 发送决策给所有节点
  await broadcastMessage(port, `decision/${decision}`);

  return decision;
}

// 发送消息给所有节点
async function broadcastMessage(port: number, message: string) {
  const promises = [];
  for (let index = 0; index < 10; index++) {
    if (index !== port - BASE_NODE_PORT) {
      promises.push(sendHttpRequest(`http://localhost:${BASE_NODE_PORT + index}/${message}`));
    }
  }
  await Promise.all(promises);
}

// 发送HTTP请求
function sendHttpRequest(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}
