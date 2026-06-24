# Docker 常用命令速查

本文档以“月薪喵”项目为例，整理常用 Docker 命令、含义和适用场景。

## 基础检查

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker --version` | 查看 Docker CLI 版本 | 确认 Docker 命令是否安装 |
| `docker version` | 查看客户端和服务端版本 | 确认 Docker Desktop / Engine 是否正常运行 |
| `docker info` | 查看 Docker Engine 详细信息 | 排查 Docker 后端、存储、运行状态 |
| `docker context ls` | 查看 Docker context | 排查当前连接的是 `desktop-linux` 还是其他后端 |

## 镜像

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker images` | 查看本机镜像 | 看已经构建或拉取了哪些镜像 |
| `docker images -a` | 查看全部镜像，包括悬空镜像 | 排查旧构建残留、`<untagged>` 镜像 |
| `docker build -t monthly-salary-meow-frontend .` | 基于当前目录 Dockerfile 构建镜像 | 修改 Dockerfile 或源码后重新生成镜像 |
| `docker history monthly-salary-meow-frontend` | 查看镜像构建层历史 | 理解镜像由哪些 Dockerfile 指令组成 |
| `docker rmi monthly-salary-meow-frontend` | 删除镜像 | 镜像不用了，释放空间 |
| `docker pull node:22-alpine` | 拉取远程镜像 | 提前下载基础镜像 |

## 容器生命周期

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker ps` | 查看正在运行的容器 | 确认月薪喵前端容器是否运行中 |
| `docker ps -a` | 查看所有容器 | 查看已停止但仍存在的容器 |
| `docker run --name monthly-salary-meow-web -p 1420:1420 monthly-salary-meow-frontend` | 创建并前台启动容器 | 第一次运行镜像，观察实时输出 |
| `docker run -d --name monthly-salary-meow-web -p 1420:1420 monthly-salary-meow-frontend` | 创建并后台启动容器 | 后台运行月薪喵前端预览 |
| `docker start monthly-salary-meow-web` | 启动已存在容器 | 容器已创建，只是处于停止状态 |
| `docker start -a monthly-salary-meow-web` | 启动并附加日志输出 | 想像前台运行一样观察启动日志 |
| `docker stop monthly-salary-meow-web` | 停止容器 | 暂停运行中的前端服务 |
| `docker restart monthly-salary-meow-web` | 重启容器 | 配置或运行状态异常时快速重启 |
| `docker rm monthly-salary-meow-web` | 删除已停止容器 | 需要用同名重新 `docker run` 时 |
| `docker run --rm ...` | 容器停止后自动删除 | 临时测试，不想留下容器记录 |

## 端口

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `-p 1420:1420` | 把宿主机 1420 映射到容器 1420 | 浏览器访问 `http://localhost:1420` |
| `docker ps` | 查看端口映射 | 确认是否存在 `0.0.0.0:1420->1420/tcp` |
| `docker inspect monthly-salary-meow-web --format "{{json .NetworkSettings.Ports}}"` | 查看容器端口配置 | 精确排查端口映射 |

## 日志

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker logs monthly-salary-meow-web` | 查看容器日志 | 查看 Vite 是否启动成功 |
| `docker logs -f monthly-salary-meow-web` | 持续跟踪日志 | 实时观察运行输出，`Ctrl + C` 只退出日志查看 |
| `docker logs --tail 50 monthly-salary-meow-web` | 查看最后 50 行日志 | 日志太多时快速看最近错误 |

## 进入容器

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker exec -it monthly-salary-meow-web sh` | 进入运行中的 Alpine 容器 shell | 查看 `/app` 文件、执行调试命令 |
| `docker exec monthly-salary-meow-web ls /app` | 在容器内执行单条命令 | 不进入 shell，直接查看目录 |
| `docker exec monthly-salary-meow-web cat /app/package.json` | 查看容器内文件内容 | 确认镜像里复制了哪些项目文件 |

容器内常用命令：

```sh
pwd
ls
ls src/assets/pet-gifs
node -v
npm -v
uname -a
exit
```

## 挂载与同步代码

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker inspect monthly-salary-meow-web --format "{{json .Mounts}}"` | 查看容器挂载 | 判断容器是否同步本地目录 |
| `-v ${PWD}:/app` | 把当前 Windows 项目目录挂到容器 `/app` | 本地改代码，容器立即看到变化 |
| `-v /app/node_modules` | 给容器内 `node_modules` 单独创建匿名 volume | 避免 Windows 版依赖覆盖 Linux 容器依赖 |

推荐的开发挂载运行方式：

```powershell
cd D:\Storage\codes\codex\monthlySalaryCat

docker run -d `
  --name monthly-salary-meow-web-dev `
  -p 1421:1420 `
  -v ${PWD}:/app `
  -v /app/node_modules `
  monthly-salary-meow-frontend
```

访问：

```text
http://localhost:1421
```

## 清理空间

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker system df` | 查看 Docker 磁盘占用 | 镜像、容器、volume 占用分析 |
| `docker image prune` | 删除悬空镜像 | 清理 `<untagged>` / dangling 镜像 |
| `docker container prune` | 删除已停止容器 | 清理不用的容器记录 |
| `docker volume ls` | 查看 volume | 检查匿名 volume 和命名 volume |
| `docker volume prune` | 删除未使用 volume | 清理依赖缓存或旧数据，执行前需确认 |
| `docker builder prune` | 清理构建缓存 | 多次 build 后释放空间 |
| `docker system prune` | 综合清理未使用资源 | 谨慎使用，会清理多个类别 |

## Docker Compose

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker compose up` | 按 `compose.yaml` 创建并前台启动服务 | 查看实时输出 |
| `docker compose up -d` | 后台启动 compose 服务 | 日常运行服务 |
| `docker compose down` | 停止并删除 compose 创建的容器和网络 | 关闭整组服务 |
| `docker compose logs` | 查看 compose 服务日志 | 排查服务启动 |
| `docker compose logs -f` | 持续查看日志 | 实时观察运行状态 |
| `docker compose ps` | 查看 compose 服务状态 | 看哪些服务正在运行 |
| `docker compose build` | 构建 compose 中定义的镜像 | Dockerfile 或源码变化后重建 |

## 导出与导入

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `docker save -o monthly-salary-meow-frontend.tar monthly-salary-meow-frontend` | 导出镜像为 tar 文件 | 离线备份或复制到另一台电脑 |
| `docker load -i monthly-salary-meow-frontend.tar` | 从 tar 文件导入镜像 | 离线恢复镜像 |

## 排查 Docker Desktop

| 命令 | 含义 | 使用场景 |
| --- | --- | --- |
| `wsl -l -v` | 查看 WSL 发行版状态 | 确认 `docker-desktop` 是否 Running |
| `wsl --shutdown` | 关闭所有 WSL 后端 | Docker Desktop 后端卡住时温和重启 |
| `Get-ChildItem \\.\pipe\ \| Where-Object { $_.Name -like "*docker*" }` | 查看 Docker 命名管道 | 排查 `dockerDesktopLinuxEngine` 是否存在 |
| `Get-Process \| Where-Object { $_.ProcessName -like "*docker*" }` | 查看 Docker 相关进程 | 排查 `com.docker.backend.exe` 是否运行 |

常见故障：

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

通常表示 Docker Desktop 的 Linux Engine 没启动或 Windows 侧 backend 没创建管道。处理顺序：

1. 退出 Docker Desktop。
2. 执行 `wsl --shutdown`。
3. 重新打开 Docker Desktop。
4. 等待 30-60 秒。
5. 执行 `docker version`，确认出现 `Server:`。

## 月薪喵项目常用流程

重新构建镜像：

```powershell
cd D:\Storage\codes\codex\monthlySalaryCat
docker build -t monthly-salary-meow-frontend .
```

重建容器：

```powershell
docker stop monthly-salary-meow-web
docker rm monthly-salary-meow-web
docker run -d --name monthly-salary-meow-web -p 1420:1420 monthly-salary-meow-frontend
```

查看运行状态：

```powershell
docker ps
docker logs monthly-salary-meow-web
```

进入容器：

```powershell
docker exec -it monthly-salary-meow-web sh
```
