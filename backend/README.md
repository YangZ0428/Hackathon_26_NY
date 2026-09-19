# StillGo — backend

Health in Climate AI Hackathon, NYC 2026 · problem 08 *Heat, air, and your plans*

## 跑起来

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.api:app --reload --port 8000
```

http://localhost:8000/docs — **这一页就是给前端的契约**。

## 数据真实性保证

这个项目**没有任何合成数据生成器**。三条规则强制执行:

1. **缺数据就报错,绝不编数。** 拿不到真实观测时返回 503,不会用"看起来合理"的默认值兜底。
2. **`fixtures/snapshot.json` 只能由 `tools/snapshot.py` 写入**,而它做的就是真去调公开 API 然后存盘。
3. **每个响应带 `requested_urls`** —— 生成这次响应时实际打了哪些 URL。复制一条到浏览器,你会拿到一样的数据。

```bash
curl -s localhost:8000/api/health                    # data_mode 应为 "live"
curl -s localhost:8000/api/compare -H 'content-type: application/json' \
  -d '{"profile_id":"mei","option_ids":["a","b","c"],"baseline_option_id":"a"}' \
  | python3 -m json.tool | grep -A4 requested_urls
```

## 三个数据源，零 API key

| 端点 | 拿什么 |
|---|---|
| `api.open-meteo.com/v1/forecast` | 逐小时气温、湿度、风速、太阳辐射 |
| `air-quality-api.open-meteo.com/v1/air-quality` | PM2.5、臭氧、US AQI |
| `api.weather.gov/alerts/active` | 官方高温 / 空气质量预警 |
| `archive-api.open-meteo.com/v1/archive` | 历史真实观测（演示用） |

空气质量是**独立域名**——不需要 EPA AirNow 的 key。NWS 必须带 `User-Agent` 头。

## 演示某个真实的高温日

九月的纽约不够热，对比演不出来。用真实的历史观测:

```bash
python tools/find_hot_day.py                  # 列出今夏最热的十二天
export STILLGO_DEMO_DATE=2026-07-15           # 换成你挑的那天
python3 -m uvicorn app.api:app --reload --port 8000
```

响应里的 `date_context` 会带上那个日期。**演示时明说**:「这是七月真实观测的数据，九月不够热。」

## 演示前防断网

```bash
python tools/snapshot.py                      # 把真实数据冻进 fixture
STILLGO_OFFLINE=1 python3 -m uvicorn app.api:app --port 8000
```

冻的是**真数据**，不是假数据。

## 六个文件，按阅读顺序

| 文件 | 管什么 |
|---|---|
| `app/heat.py` | 热应激模型，五步。**整个项目的心脏** |
| `app/explain.py` | 消融法：差值从哪来 |
| `app/weather.py` | 三个数据源 + 三级降级 + URL 记录 |
| `app/content.py` | 读三个 JSON，代码与内容的分界 |
| `app/api.py` | 五个端点，只组装不算数 |
| `app/schemas.py` | **响应结构，已冻结** — 改之前先跟前端说 |

`data/*.json` 是内容不是代码 —— 只改这里，不碰任何 .py。

## 待办

- [ ] `canopy_shade` 换成真值（街树普查，或 FortyGuard 实测温度）
- [ ] `_resources()` 接 Cool It NYC 真实数据
- [ ] `heat.BANDS` 阈值锚到 NWS HeatRisk / EPA AirNow 官方表
- [ ] `profiles.json` 从 4 份扩到 10 份
- [ ] 敏感性分析：证明推荐结果不依赖那些假设的系数
