# yuncoding.top 部署说明

这个项目不是纯静态站，前端和 `/api/*` 都由 FastAPI 提供。`yuncoding.top` 推荐用 Nginx 反向代理到本机 Uvicorn 服务。

## 1. DNS

在域名服务商后台添加：

| 主机记录 | 类型 | 值 |
| --- | --- | --- |
| `@` | `A` | 服务器公网 IP |
| `www` | `CNAME` | `yuncoding.top` |

等待 DNS 生效后再继续服务器配置。

## 2. 安装依赖

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

## 3. 启动后端服务

```bash
sudo cp deploy/systemd/kaifan.service /etc/systemd/system/kaifan.service
sudo systemctl daemon-reload
sudo systemctl enable --now kaifan
curl http://127.0.0.1:6053/api/health
```

如果健康检查返回 `{"status":"ok"}`，说明应用服务正常。

## 4. 绑定 Nginx

```bash
sudo cp deploy/nginx/yuncoding.top.conf /etc/nginx/sites-available/yuncoding.top
sudo ln -sf /etc/nginx/sites-available/yuncoding.top /etc/nginx/sites-enabled/yuncoding.top
sudo nginx -t
sudo systemctl reload nginx
```

随后申请 HTTPS 证书：

```bash
sudo certbot --nginx -d yuncoding.top -d www.yuncoding.top
```

证书完成后访问：

- `https://yuncoding.top/`
- `https://www.yuncoding.top/`

## 5. 更新代码

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

## 6. 常用排查

```bash
sudo systemctl status kaifan
sudo journalctl -u kaifan -f
sudo nginx -t
curl http://127.0.0.1:6053/api/health
```
