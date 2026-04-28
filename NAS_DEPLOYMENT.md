# NAS 部署指南

## 支持的 NAS 系统

- ✅ 群晖 Synology DSM 7.0+（Container Manager）
- ✅ 威联通 QNAP（Container Station）
- ✅ 其他支持 Docker 的 NAS 系统

---

## 一、群晖 Synology 部署

### 前置要求
- DSM 7.0 或更高版本
- 已安装 Container Manager（套件中心搜索安装）
- 至少 2GB 可用内存

### 部署步骤

#### 1. 创建共享文件夹
在 `控制面板 > 共享文件夹` 中创建：
- `docker/openclaw` - 用于存放配置和数据

#### 2. 准备目录结构
通过 File Station 或 SSH 创建：
```
docker/openclaw/
├── openclaw-data/          # OpenClaw 配置目录
├── openclaw-workspace/     # 工作区目录
└── openclaw-logs/          # 日志目录（可选）
```

#### 3. 使用 Container Manager 部署

**方法 A：使用项目（推荐）**

1. 打开 Container Manager
2. 点击 `项目` > `新增`
3. 项目名称：`openclaw`
4. 路径：选择 `docker/openclaw`
5. 来源：选择 `创建 docker-compose.yml`
6. 粘贴以下内容：

```yaml
version: '3.8'

services:
  openclaw:
    image: openclaw/openclaw:latest
    container_name: openclaw
    restart: unless-stopped
    ports:
      - "18789:18789"
    volumes:
      - /volume1/docker/openclaw/openclaw-data:/root/.openclaw
      - /volume1/docker/openclaw/openclaw-workspace:/root/.openclaw/workspace
      - /volume1/docker/openclaw/openclaw-logs:/root/.openclaw/logs
    environment:
      - TZ=Asia/Shanghai
      - OPENCLAW_GATEWAY_PORT=18789
      - OPENCLAW_GATEWAY_HOST=0.0.0.0
```

7. 点击 `完成` 启动

**方法 B：手动创建容器**

1. 打开 Container Manager > 容器
2. 点击 `新增` > `从 Docker Hub 搜索`
3. 搜索 `openclaw/openclaw`，选择 `latest` 标签
4. 配置容器：
   - 容器名称：`openclaw`
   - 启用自动重新启动
5. 高级设置：
   - **端口设置**：
     - 本地端口：18789
     - 容器端口：18789
     - 类型：TCP
   - **卷**：
     - `/volume1/docker/openclaw/openclaw-data` → `/root/.openclaw`
     - `/volume1/docker/openclaw/openclaw-workspace` → `/root/.openclaw/workspace`
   - **环境**：
     - `TZ=Asia/Shanghai`
     - `OPENCLAW_GATEWAY_PORT=18789`
6. 应用并启动

#### 4. 验证部署

1. 在 Container Manager 中查看容器状态（应为 `运行中`）
2. 查看日志：点击容器 > `详情` > `日志`
3. 测试访问：浏览器打开 `http://NAS_IP:18789`

#### 5. 在 openclaw manager 中添加实例

1. 打开 openclaw manager
2. 点击 `+` 添加实例
3. 填写信息：
   - 名称：`我的 NAS`
   - 类型：`nas`
   - 地址：`http://192.168.x.x:18789`（替换为 NAS IP）
4. 保存并切换

---

## 二、威联通 QNAP 部署

### 前置要求
- QTS 4.5+ 或 QuTS hero
- 已安装 Container Station
- 至少 2GB 可用内存

### 部署步骤

#### 1. 创建共享文件夹
在 `控制台 > 权限设置 > 共享文件夹` 中创建：
- `Container/openclaw`

#### 2. 使用 Container Station 部署

**方法 A：使用 Create Application（推荐）**

1. 打开 Container Station
2. 点击 `Create` > `Create Application`
3. 应用名称：`openclaw`
4. 粘贴 docker-compose.yml 内容（同上，路径改为 `/share/Container/openclaw/...`）
5. 验证并创建

**方法 B：手动创建容器**

1. 打开 Container Station > 容器
2. 点击 `Create` > `Search`
3. 搜索 `openclaw/openclaw`
4. 配置容器（同群晖步骤）

#### 3. 验证和添加实例
同群晖步骤 4-5

---

## 三、通用 Docker 部署（适用于所有 NAS）

如果 NAS 支持 SSH 和 Docker，可以直接使用命令行：

```bash
# 1. SSH 登录 NAS
ssh admin@nas-ip

# 2. 创建目录
mkdir -p /volume1/docker/openclaw/{openclaw-data,openclaw-workspace,openclaw-logs}

# 3. 运行容器
docker run -d \
  --name openclaw \
  --restart unless-stopped \
  -p 18789:18789 \
  -v /volume1/docker/openclaw/openclaw-data:/root/.openclaw \
  -v /volume1/docker/openclaw/openclaw-workspace:/root/.openclaw/workspace \
  -v /volume1/docker/openclaw/openclaw-logs:/root/.openclaw/logs \
  -e TZ=Asia/Shanghai \
  -e OPENCLAW_GATEWAY_PORT=18789 \
  -e OPENCLAW_GATEWAY_HOST=0.0.0.0 \
  openclaw/openclaw:latest

# 4. 查看日志
docker logs -f openclaw

# 5. 停止容器
docker stop openclaw

# 6. 启动容器
docker start openclaw

# 7. 更新容器
docker pull openclaw/openclaw:latest
docker stop openclaw
docker rm openclaw
# 重新运行步骤 3
```

---

## 四、常见问题

### Q1: 容器无法启动？
**A:** 检查：
1. 端口 18789 是否被占用：`netstat -tuln | grep 18789`
2. 挂载目录权限：`chmod -R 755 /volume1/docker/openclaw`
3. 查看容器日志：Container Manager > 容器 > 详情 > 日志

### Q2: 局域网无法访问？
**A:** 检查：
1. NAS 防火墙设置（控制面板 > 安全性 > 防火墙）
2. 添加规则：允许端口 18789
3. 或临时关闭防火墙测试

### Q3: 权限错误？
**A:** 
```bash
# SSH 登录 NAS 后执行
chmod -R 755 /volume1/docker/openclaw
chown -R 1000:1000 /volume1/docker/openclaw
```

### Q4: 容器内无法访问外网？
**A:** 检查 NAS 网络设置和 DNS 配置

### Q5: 如何更新 OpenClaw？
**A:** 
- Container Manager：项目 > 停止 > 拉取最新镜像 > 启动
- 命令行：见上方"通用 Docker 部署"第 7 步

### Q6: 如何备份配置？
**A:** 
1. 停止容器
2. 复制 `openclaw-data` 和 `openclaw-workspace` 目录
3. 或使用 openclaw manager 的备份功能

### Q7: 容器占用太多内存？
**A:** 在 docker-compose.yml 中添加资源限制：
```yaml
services:
  openclaw:
    # ... 其他配置
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
```

---

## 五、性能优化建议

### 1. 使用 SSD 缓存
如果 NAS 有 SSD 缓存，将 `openclaw-data` 目录放在 SSD 上

### 2. 调整 Docker 资源限制
根据 NAS 配置调整内存和 CPU 限制

### 3. 定期清理日志
```bash
# 限制日志大小
docker run ... --log-opt max-size=10m --log-opt max-file=3 ...
```

### 4. 使用 host 网络模式（高级）
如果遇到网络性能问题，可以使用 host 模式：
```yaml
services:
  openclaw:
    network_mode: host
    # 移除 ports 配置
```

---

## 六、安全建议

1. **不要暴露到公网**：仅在局域网内使用
2. **使用强密码**：如果配置了认证
3. **定期更新**：保持 OpenClaw 版本最新
4. **备份配置**：定期备份 `openclaw-data` 目录
5. **限制访问**：使用 NAS 防火墙限制访问 IP

---

## 七、卸载

### 群晖
1. Container Manager > 项目 > 选择 `openclaw` > 停止 > 删除
2. 删除共享文件夹 `docker/openclaw`（可选）

### 威联通
1. Container Station > 应用 > 选择 `openclaw` > 删除
2. 删除共享文件夹 `Container/openclaw`（可选）

### 命令行
```bash
docker stop openclaw
docker rm openclaw
docker rmi openclaw/openclaw:latest
rm -rf /volume1/docker/openclaw  # 谨慎操作
```

---

**部署完成后，在 openclaw manager 中添加 NAS 实例即可开始使用！**
