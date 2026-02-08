# JBCH Word Bank - 프로젝트 문서

## 📌 프로젝트 개요

**JBCH Word Bank**는 영상 스트리밍 서비스로, Cloudflare Pages와 R2를 활용하여 무료/저비용으로 운영 가능한 넷플릭스 스타일의 영상 플랫폼입니다.

### 서비스 URL
| 용도 | URL |
|------|-----|
| **웹사이트** | https://jbchbank.haebomsoft.com |
| **영상 저장소** | https://videos.haebomsoft.com |
| **Cloudflare Pages** | https://bank-bxw.pages.dev |

### 기술 스택
- **Frontend**: Next.js 15, React 18, TailwindCSS
- **Hosting**: Cloudflare Pages
- **Storage**: Cloudflare R2 (S3 호환)
- **Database**: Cloudflare KV (조회수 저장)
- **CDN**: Cloudflare (전 세계 300+ 엣지 서버)

---

## 💰 비용 구조

| 항목 | 무료 범위 | 초과 시 비용 |
|------|----------|-------------|
| **R2 저장소** | 10GB | $0.015/GB/월 |
| **R2 대역폭** | 무제한 | 무료 |
| **Pages 호스팅** | 무제한 | 무료 |
| **KV 저장소** | 1GB | $0.50/GB/월 |

### 예상 비용
- **10GB 이하**: 완전 무료
- **1TB 저장**: 월 약 $15 (₩20,000)
- **10TB 저장**: 월 약 $150 (₩200,000)

---

## 🏗️ 프로젝트 구조

```
bank/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── videos/
│   │   │       ├── folders/route.ts    # 폴더/파일 목록 API
│   │   │       ├── stream/route.ts     # 영상 스트리밍 API
│   │   │       ├── download/route.ts   # 영상 다운로드 API
│   │   │       ├── views/route.ts      # 조회수 추적 API
│   │   │       └── popular/route.ts    # 인기 Top10 API
│   │   ├── layout.tsx                  # 루트 레이아웃
│   │   └── page.tsx                    # 메인 페이지
│   ├── components/
│   │   ├── FolderBrowser.tsx           # 폴더/영상 탐색 컴포넌트
│   │   ├── VideoCard.tsx               # 영상 카드 (미리보기)
│   │   └── SearchHeader.tsx            # 검색 헤더
│   └── lib/
│       └── r2.ts                       # R2 클라이언트 (Bindings)
├── wrangler.toml                       # Cloudflare 설정
├── next.config.ts                      # Next.js 설정
└── package.json
```

---

## 🔧 Cloudflare 설정

### 1. R2 버킷
- **버킷 이름**: `jbch-word-bank-videos`
- **바인딩 이름**: `VIDEOS`
- **Public Access**: 활성화
- **Custom Domain**: `videos.haebomsoft.com`

### 2. KV Namespace
- **이름**: `jbch-views`
- **바인딩 이름**: `VIEWS`
- **용도**: 영상 조회수 저장

### 3. Pages 프로젝트
- **프로젝트 이름**: `bank`
- **GitHub 연동**: `traceoftu/bank`
- **Custom Domain**: `jbchbank.haebomsoft.com`

### 4. 캐싱 설정 (Cache Rules)
- **Rule name**: `Video Cache`
- **Hostname**: `videos.haebomsoft.com`
- **Edge TTL**: 1 year
- **Browser TTL**: 7 days

---

## 🎬 주요 기능

### 1. 폴더 탐색
- R2 버킷의 폴더 구조를 그대로 표시
- 브레드크럼 네비게이션

### 2. 영상 스트리밍
- R2 Public Access URL로 직접 스트리밍
- 무제한 대역폭, 빠른 속도

### 3. 영상 미리보기 (넷플릭스 스타일)
- 마우스 호버 시 0.5초 후 자동 재생
- 영상 첫 프레임을 썸네일로 표시

### 4. 인기 Top 10
- 조회수 기반 인기 영상 표시
- 넷플릭스 스타일 세로 비율 (2:3)
- 큰 순위 숫자 표시

### 5. 검색
- 파일명 및 경로에서 부분 일치 검색
- 모든 파일 페이지네이션 지원

### 6. 다운로드
- 영상 플레이어 기본 다운로드 버튼 사용

---

## 📁 API 엔드포인트

### GET /api/videos/folders
폴더 및 파일 목록 조회
```
?path=한국어/성인    # 특정 폴더
?q=이정국           # 검색
```

### GET /api/videos/stream
영상 스트리밍 (R2 Public URL로 리다이렉트)
```
?path=한국어/성인/영상.mp4
```

### GET /api/videos/download
영상 다운로드 (R2 Public URL로 리다이렉트)
```
?path=한국어/성인/영상.mp4
```

### GET /api/videos/popular
인기 Top 10 영상 조회 (조회수 기준)

### POST /api/videos/views
조회수 증가
```json
{ "path": "한국어/성인/영상.mp4" }
```

---

## 🚀 배포 방법

### 1. GitHub Push
```bash
git add .
git commit -m "변경 내용"
git push
```
Cloudflare Pages가 자동으로 빌드 및 배포합니다.

### 2. 수동 배포
```bash
npm run build
npm run deploy
```

---

## 🔄 유지보수

### 영상 업로드
1. Cloudflare 대시보드 → R2 → `jbch-word-bank-videos`
2. 폴더 구조에 맞게 영상 업로드
3. 권장: H.265 코덱으로 압축 (용량 50-70% 절감)

### 조회수 초기화
Cloudflare 대시보드 → KV → `jbch-views` → 키 삭제

### 캐시 삭제
Cloudflare 대시보드 → `haebomsoft.com` → Caching → Purge Cache

---

## 📝 환경 변수

Cloudflare Pages에서 자동으로 R2 Bindings를 사용하므로 별도 환경 변수 설정이 필요 없습니다.

### wrangler.toml
```toml
name = "jbch-word-bank"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "VIDEOS"
bucket_name = "jbch-word-bank-videos"

[[kv_namespaces]]
binding = "VIEWS"
id = "views_kv_id"
```

---

## 🔗 관련 링크

- **Cloudflare 대시보드**: https://dash.cloudflare.com
- **GitHub 저장소**: https://github.com/traceoftu/bank
- **Cloudflare R2 문서**: https://developers.cloudflare.com/r2/
- **Cloudflare Pages 문서**: https://developers.cloudflare.com/pages/

---

## 📅 개발 히스토리

### 2026-02-09
- Vercel + Synology → Cloudflare Pages + R2 마이그레이션
- R2 Public Access 설정
- Custom Domain 설정 (jbchbank.haebomsoft.com, videos.haebomsoft.com)
- 캐싱 최적화 (Edge TTL 1년, Browser TTL 7일)
- 검색 기능 구현 (부분 일치)
- 넷플릭스 스타일 UI 구현
  - 호버 시 영상 미리재생
  - 영상 첫 프레임 썸네일
  - 인기 Top 10 (조회수 기반)
  - 세로 비율 카드 (2:3)
  - 큰 순위 숫자

---

## ⚠️ 주의사항

1. **Next.js 버전**: 15.x 사용 (16 이상은 @cloudflare/next-on-pages 호환 문제)
2. **Edge Runtime**: 모든 API 라우트에 `export const runtime = 'edge';` 필수
3. **R2 Bindings**: AWS SDK 대신 Cloudflare Bindings 사용 (서명 불필요)
4. **스트리밍**: Workers CPU 제한으로 인해 R2 Public URL로 직접 리다이렉트

---

*마지막 업데이트: 2026-02-09*
