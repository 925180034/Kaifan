# yuncoding.top 部署说明

这个项目不是纯静态站，前端和 `/api/*` 都由 FastAPI 提供。`yuncoding.top` 推荐用 Nginx 反向代理到本机 Uvicorn 服务。

## 1. DNS

在域名服务商后台添加：

| 主机记录 | 类型 | 值 |
| --- | --- | --- |
| `@` | `A` | 服务器公网 IP |
| `www` | `CNAME` | `yuncoding.top` |

等待 DNS 生效后再继续服务器配置。

## 2. 安全组

在腾讯云服务器安全组入站规则放行：

| 协议 | 端口 | 来源 |
| --- | --- | --- |
| TCP | 22 | 你的管理 IP 或 `0.0.0.0/0` |
| TCP | 80 | `0.0.0.0/0` |
| TCP | 443 | `0.0.0.0/0` |

`6053` 不需要对公网开放，它只给本机 Nginx 反向代理使用。

## 3. 安装依赖

在服务器上执行：

```bash
cd /root/Kaifan
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
npm ci
cp .env.example .env.local
```

编辑 `.env.local`，填入真实的 `DEEPSEEK_API_KEY`。不要提交 `.env.local`。

## 4. 启动后端服务

```bash
sudo cp deploy/systemd/kaifan.service /etc/systemd/system/kaifan.service
sudo systemctl daemon-reload
sudo systemctl enable --now kaifan
curl http://127.0.0.1:6053/api/health
```

如果健康检查返回 `{"status":"ok"}`，说明应用服务正常。

如果服务反复重启且日志出现 `address already in use`，说明 6053 已被手动启动的 Uvicorn 占用。先停止手动进程，再让 systemd 接管：

```bash
sudo ss -ltnp 'sport = :6053'
sudo systemctl restart kaifan
```

## 5. 绑定 Nginx

```bash
sudo cp deploy/nginx/yuncoding.top.conf /etc/nginx/sites-available/yuncoding.top
sudo ln -sf /etc/nginx/sites-available/yuncoding.top /etc/nginx/sites-enabled/yuncoding.top
sudo nginx -t
sudo systemctl reload nginx
```

随后申请 HTTPS 证书：

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yuncoding.top -d www.yuncoding.top
```

如果服务器设置了本机代理导致 apt 访问源出现 `127.0.0.1:7890` 或 `503`，临时绕过代理执行：

```bash
sudo env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY apt-get update
sudo env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY apt-get install -y certbot python3-certbot-nginx
```

证书完成后访问：

- `https://yuncoding.top/`
- `https://www.yuncoding.top/`

## 6. 更新代码

以后更新线上版本：

```bash
cd /root/Kaifan
git pull
. .venv/bin/activate
pip install -r requirements.txt
npm ci
npm run check
sudo systemctl restart kaifan
```

更新后建议在无痕窗口打开页面一次。首次访问会创建匿名会话；用户画像、收藏和反馈请求需要浏览器自动附带的会话令牌。设置页的“所在城市”为可选项，填写后会通过 Open-Meteo 获取当天当前天气。DeepSeek 连续生成超过 `4 次/分钟` 时，页面会自动降级为本地规则方案。

## 7. 常用排查

```bash
sudo systemctl status kaifan
sudo journalctl -u kaifan -f
sudo nginx -t
curl http://127.0.0.1:6053/api/health
curl --resolve yuncoding.top:443:127.0.0.1 https://yuncoding.top/api/health
```
