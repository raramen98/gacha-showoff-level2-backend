# 🎰 뽑았다! 바꿔요! — 갓챠 자랑 & 교환 · 백엔드 (Level 2)

가챠에서 뽑은 캐릭터를 자랑하고, 중복으로 뽑은 캐릭터를 서로 교환 신청·수락하는 서비스의 **API 서버**예요.
NestJS + PostgreSQL로 만들었고, 화면(프론트엔드)은 [gacha-showoff-level2-frontend](https://github.com/raramen98/gacha-showoff-level2-frontend) 저장소에 있어요.
Level 1(`gacha_l1` 스키마)과는 저장소·배포·DB 스키마가 모두 분리되어 있어요.

- 기획서: [기획서.md](./기획서.md)

> ⏰ **첫 접속이 느릴 수 있어요**
> Render **무료 서버**라서 15분 동안 아무도 쓰지 않으면 서버가 잠들어요.
> 잠든 뒤 처음 접속하면 서버가 깨어나는 데 **1분 가까이** 걸릴 수 있어요. 잠시 기다린 뒤 새로고침해 주세요.
> 한 번 깨어나면 그다음부터는 빠르게 응답해요.

## 기술
- NestJS 10 (Node.js 18.18 이상)
- PostgreSQL (`pg`) — 모든 테이블은 **`gacha_l2` 스키마** 안에 있어요 (Level 1의 `gacha_l1`은 건드리지 않아요)
- 사진은 DB(`gacha_l2.posts.image_data`)에 함께 저장해요

## API
| 기능 | 주소 |
|---|---|
| DB 연결 상태 확인 | `GET /health` |
| 시리즈 목록 | `GET /series` |
| 시리즈 상세 (+자랑 글) | `GET /series/:id` |
| 시리즈 등록 | `POST /series` |
| 자랑 글 목록 (검색·필터) | `GET /posts?q=&ip=&rarity=&tradable=true` |
| 자랑 글 상세 | `GET /posts/:id` |
| 자랑 글 사진 | `GET /posts/:id/image` |
| 자랑 글 등록 | `POST /posts` (multipart/form-data) |
| 교환 신청 | `POST /trades` `{ target_post_id, offer_post_id, requester_nickname }` |
| 교환 신청 취소 | `PATCH /trades/:id/cancel` `{ nickname }` |
| 교환 수락·거절 | `PATCH /trades/:id/accept`, `PATCH /trades/:id/reject` `{ nickname }` |
| 내 교환 목록 | `GET /trades?nickname=` (보낸 신청 `sent`, 받은 신청 `received`) |
| 현황 숫자 | `GET /stats` |
| "지금 나는"에서 고를 닉네임 | `GET /users` |
| 가상 데이터 다시 채우기 | `POST /admin/reseed` (`gacha_l2` 데이터만 지우고 다시 채움) |

### 교환 규칙 (모두 백엔드에서 확인)
로그인은 Level 3 범위라서, 화면 위 "지금 나는"에서 고른 닉네임을 요청 본문에 담아 보내요.
| # | 규칙 | 거절할 때 안내 (`400`, `rule` 번호 포함) |
|---|---|---|
| 1 | 내 아이템에는 내가 교환 신청할 수 없다 | 내가 올린 아이템에는 교환 신청을 할 수 없어요. |
| 2 | 같은 아이템에 같은 사람이 대기 중인 신청을 또 걸 수 없다 | 이미 이 아이템에 교환을 신청했어요. 내 교환에서 확인해 주세요. |
| 3 | 교환 완료·교환 안 함 아이템에는 신청할 수 없다 | 이 아이템은 지금 교환할 수 없어요. |
| 4 | 한 사람의 대기 중 신청은 동시에 3건까지 | 교환 신청은 동시에 3건까지만 할 수 있어요. 기존 신청을 정리해 주세요. |
| 5 | 줄 아이템은 내 것이고 교환 가능 상태여야 한다 | 내 아이템 중 교환 가능한 것만 내놓을 수 있어요. |

- 취소는 신청한 본인만(아니면 `403`), 대기 중일 때만(아니면 `409`) 할 수 있어요.
- 수락·거절은 아이템 주인만 할 수 있어요. 수락하면 한 트랜잭션 안에서 두 아이템이 `traded`가 되고, 두 아이템에 걸린 다른 대기 신청은 자동으로 `rejected`가 돼요.
- 동시에 여러 요청이 와도 규칙이 깨지지 않도록 아이템 행을 잠그고, 규칙 2는 DB 고유 인덱스로도 한 번 더 막아요.

- 자랑 글 등록에는 `image`(사진, **필수**, JPG·PNG·WEBP·GIF, 5MB 이하), `series_id`(선택), `nickname`(2~12자), `character_name`, `rarity`(`common`/`rare`/`secret`), `comment`(100자 이내), `trade_status`(`available`/`not_for_trade`)를 보내요.
- 업로드 날짜는 등록 시각(`created_at`)이 자동으로 들어가요.
- 입력이 틀리면 `400`과 함께 쉬운 한국어로 이유를 돌려줘요.
  ```json
  { "statusCode": 400, "message": "사진을 올려 주세요", "errors": { "image": "사진을 올려 주세요", "nickname": "닉네임을 적어 주세요" } }
  ```
- `/health` 예시
  ```json
  { "status": "ok", "db": "connected", "message": "DB에 잘 연결되어 있어요.", "schema": "gacha_l2", "counts": { "series": 12, "posts": 56, "trade_requests": 15 } }
  ```

## 데이터 구조 (`gacha_l2` 스키마)
- `series` — 가챠 시리즈 (작품 이름, 시리즈 이름, 1회 가격, 출시일)
- `posts` — 자랑 글 = 아이템 (시리즈(선택), 닉네임, 캐릭터, 레어도, 한마디, 사진, **교환 상태** `available`/`not_for_trade`/`traded`, 업로드 날짜)
- `trade_requests` — 교환 신청 (받고 싶은 아이템, 대신 줄 아이템, 신청한 사람, 상태 `pending`/`accepted`/`rejected`/`canceled`, 시각)
- 시리즈 하나에 자랑 글 여러 개 (`posts.series_id` → `series.id`, 1:N)
- 자랑 글 하나에 교환 신청 여러 개 (`trade_requests.target_post_id` → `posts.id`, 1:N), 줄 아이템은 `offer_post_id` → `posts.id`

## 내 컴퓨터에서 실행하기
```bash
npm install
cp .env.example .env    # .env를 열어 DATABASE_URL에 DB 주소 적기
npm run db:setup        # gacha_l2 스키마와 테이블 만들기 (여러 번 해도 안전)
npm run db:seed         # 가상 데이터 넣기 (이미 있으면 건너뜀)
npm run start:dev       # http://localhost:4001
```
- 가상 데이터를 처음부터 다시 넣으려면 `npm run db:reset` 또는 현황 화면의 버튼 (`gacha_l2`의 데이터만 지워요)
- 가상 데이터: 시리즈 12개, 자랑 글 56개(6개는 오늘 올린 글), 닉네임 8명, 교환 신청 15건. '오늘도꽝'은 대기 중 신청 3건을 갖고 있어요.

## 설정값 (.env)
| 이름 | 뜻 | 예 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 접속 주소 | `postgresql://사용자:비밀번호@호스트/DB이름` |
| `DB_SSL` | SSL로 DB에 접속할지 (Render DB는 `true`) | `true` |
| `PORT` | 서버 포트 (Render에서는 자동으로 정해짐) | `4001` |
| `CORS_ORIGIN` | 이 API를 부를 수 있는 프론트엔드 주소 (여러 개면 쉼표로 구분) | `http://localhost:3001` |

> `.env`는 `.gitignore`에 들어 있어서 GitHub에 올라가지 않아요. 값의 이름만 `.env.example`에 있어요.

## Render에 올리기
> Level 1과 다른 **새 Render 서비스**로 만들어 주세요. (`render.yaml`의 서비스 이름: `gacha-showoff-level2-backend`)

1. Render → **New → Web Service** → 이 저장소 선택 (또는 **New → Blueprint**로 `render.yaml` 사용)
2. 설정
   | 항목 | 값 |
   |---|---|
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |
3. Environment에 `DATABASE_URL`, `DB_SSL`, `CORS_ORIGIN`, `NODE_VERSION`(`20`)을 넣기
4. 배포가 끝나면 `https://<서비스 이름>.onrender.com/health`에서 `"db":"connected"`가 나오는지 확인
