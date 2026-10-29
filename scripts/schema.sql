-- 갓챠 자랑 & 교환 Level 2 — 모든 테이블은 gacha_l2 스키마 안에만 만든다.
-- (같은 DB에 Level 1의 gacha_l1이 있으니 다른 스키마는 건드리지 않음)
CREATE SCHEMA IF NOT EXISTS gacha_l2;

-- 테이블 1: 가챠 시리즈 (Level 1과 같음)
CREATE TABLE IF NOT EXISTS gacha_l2.series (
  id           SERIAL PRIMARY KEY,
  ip_name      VARCHAR(30)  NOT NULL,
  name         VARCHAR(60)  NOT NULL,
  price        INTEGER      NOT NULL CHECK (price >= 0),
  release_date DATE         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 테이블 2: 자랑 글 = 교환할 수 있는 아이템 (시리즈 하나에 자랑 글 여러 개, 1:N)
-- Level 1의 칸에 trade_status(교환 상태)를 더했다
CREATE TABLE IF NOT EXISTS gacha_l2.posts (
  id             SERIAL PRIMARY KEY,
  series_id      INTEGER      REFERENCES gacha_l2.series(id) ON DELETE SET NULL,
  nickname       VARCHAR(12)  NOT NULL CHECK (char_length(nickname) >= 2),
  character_name VARCHAR(50)  NOT NULL,
  rarity         VARCHAR(10)  NOT NULL CHECK (rarity IN ('common', 'rare', 'secret')),
  comment        VARCHAR(100) NOT NULL DEFAULT '',
  image_type     VARCHAR(20),
  image_data     BYTEA,
  trade_status   VARCHAR(15)  NOT NULL DEFAULT 'available'
                 CHECK (trade_status IN ('available', 'not_for_trade', 'traded')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_series_id_idx ON gacha_l2.posts (series_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON gacha_l2.posts (created_at DESC);

-- 테이블 3: 교환 신청 (자랑 글 하나에 교환 신청 여러 개, 1:N — 받고 싶은 아이템 기준)
CREATE TABLE IF NOT EXISTS gacha_l2.trade_requests (
  id                 SERIAL PRIMARY KEY,
  target_post_id     INTEGER     NOT NULL REFERENCES gacha_l2.posts(id) ON DELETE CASCADE,
  offer_post_id      INTEGER     NOT NULL REFERENCES gacha_l2.posts(id) ON DELETE CASCADE,
  requester_nickname VARCHAR(12) NOT NULL,
  status             VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_post_id <> offer_post_id)
);

CREATE INDEX IF NOT EXISTS trade_requests_target_idx ON gacha_l2.trade_requests (target_post_id);
CREATE INDEX IF NOT EXISTS trade_requests_offer_idx ON gacha_l2.trade_requests (offer_post_id);
CREATE INDEX IF NOT EXISTS trade_requests_requester_idx ON gacha_l2.trade_requests (requester_nickname);
-- 규칙 2를 DB에서도 한 번 더: 같은 사람이 같은 아이템에 대기 중 신청을 두 개 가질 수 없다
CREATE UNIQUE INDEX IF NOT EXISTS trade_requests_one_pending_idx
  ON gacha_l2.trade_requests (target_post_id, requester_nickname) WHERE status = 'pending';
