# 동물병원 EMR 시스템 — 설계 문서

- 작성일: 2026-07-07
- 상태: 설계 승인 대기 (사용자 리뷰 중)
- 성격: 실병원 도입 전제의 MVP

## 1. 개요

2차 동물병원(전문/의뢰 병원)을 위한 웹 기반 EMR 시스템. 1차 병원에서 의뢰한
환자를 진료하고, 진료 기록·처방·의료영상·입원 바이털을 관리한다. 의뢰한 1차
병원과 보호자에게는 **읽기 전용**으로 해당 환자의 기록을 공유한다.

### 배경 (도메인 특이사항)
- 우리 병원은 **2차 병원**. 1차 병원이 치료하기 어려운 환자를 의뢰받는다.
- 치료 후 다시 1차 병원으로 보내는데, 입원 중 보호자가 1차 병원에 문의하는
  일이 잦다. → 1차 병원에도 **읽기 권한**을 주어 직접 확인하게 한다.
- 보호자에게도 자기 반려동물 기록을 **읽기 전용**으로 제공한다.

## 2. 사용자 역할 (3종)

| 역할 | 설명 | 권한 |
|---|---|---|
| **staff** | 우리 병원(2차) 직원 | 전체 읽기/쓰기 |
| **referring_vet** | 의뢰한 1차 병원 | 자기가 의뢰한 환자만 읽기 |
| **owner** | 보호자 | 자기 반려동물만 읽기 |

- 외부 사용자(owner, referring_vet)는 **병원이 발급하는 초대 링크/코드**로 가입·접속.

## 3. 기술 스택

- **프런트/백엔드**: Next.js (App Router) — EMR 웹 + 보호자/1차병원 포털을 한
  코드베이스에서. 보호자 "앱"은 MVP에서 **모바일 웹**으로 제공(추후 네이티브
  래핑 용이).
- **DB / 인증 / 파일 스토리지**: Supabase (Postgres + Auth + Storage + **RLS**)
- **배포**: **Railway** (Next.js 앱 호스팅). Supabase는 클라우드 서비스로
  네트워크 연결.
- **차트(바이털 그래프)**: Recharts

### DB 선택 근거
- 핵심 이유는 **권한**. "1차 병원은 자기 의뢰 환자만", "보호자는 자기 개만"
  같은 규칙을 앱 코드로만 지키면 버그 하나로 타 환자 의료정보가 노출된다.
  Supabase **RLS(Row Level Security)** 는 이 규칙을 DB 자체에 강제하여, 앱에
  버그가 있어도 데이터가 새지 않게 막는다. 의료 데이터에는 필수급.
- 관계형 쿼리(환자 검색, 회차 조회, 바이털 시계열)가 상시 필요 → JSON 파일
  저장(R2 등) 방식은 부적합.
- 큰 파일(X-ray/MRI/CT, 사진, 영상)은 **오브젝트 스토리지**(Supabase Storage,
  S3 호환)에 저장하고 DB에는 경로+메타만. 필요 시 추후 R2로 이관 가능.

## 4. 데이터 모델

```
referring_hospital (1차 병원)
    └─< patient (반려동물) >── owner (보호자)
                │
                ├─< visit (진료 회차) ──< prescription >── drug (약품 마스터)
                │        ├─< medical_image  (X-ray/MRI/CT)
                │        └─< media          (일반 사진/영상)
                │
                └─< admission (입원) ──< vital (바이털 시계열)

profile (사용자 + 역할)      invite (초대 코드/링크)
```

### 테이블 정의 (초안)

- **owner** — id, 이름, 연락처, created_at
- **referring_hospital** — id, 병원명, 연락처, created_at
- **patient** — id, owner_id(FK), referring_hospital_id(FK, nullable), 이름,
  종(species), 품종(breed), 성별, 생일, 비고, created_at
- **visit** — id, patient_id(FK), 진료일, 회차번호, 진료텍스트(주소견/진단/메모),
  작성자(staff), created_at
- **drug** — id, 약품명, 용량단위, 규격, 비고 (처방과 분리된 마스터)
- **prescription** — id, visit_id(FK), drug_id(FK), 용량, 용법, 기간, 비고
- **medical_image** — id, visit_id(FK), modality(xray/mri/ct), storage_path,
  파일명, 업로드시각
- **media** — id, visit_id(FK, nullable), patient_id(FK), 타입(보행/치료전후 등),
  storage_path, 파일명, 업로드시각
- **admission** — id, patient_id(FK), 입원일, 퇴원일(nullable),
  상태(admitted/discharged), 비고
- **vital** — id, admission_id(FK), 측정시각, 체온, 심박수, 호흡수, 혈압,
  기타(확장 가능), 기록자
- **profile** — id(= auth.users.id), role(staff/referring_vet/owner),
  referring_hospital_id(nullable), owner_id(nullable), 이름
- **invite** — id, code/token, 대상 role, 연결대상(owner_id 또는
  referring_hospital_id), 만료일, 사용여부, 발급자(staff)

### RLS 정책 (요지)
- `staff`: 모든 테이블 read/write.
- `referring_vet`: `patient.referring_hospital_id = 본인 hospital_id` 인 환자와
  그 하위(visit/prescription/medical_image/media/admission/vital)만 **read**.
- `owner`: `patient.owner_id = 본인 owner_id` 인 환자와 그 하위만 **read**.
- `drug`(마스터)는 staff write, 조회는 처방 조인 범위 내에서 노출.
- Storage 버킷도 동일 원칙으로 접근 제어(서명 URL 또는 RLS 연동).

## 5. MVP 기능 범위

### EMR (staff 웹, 쓰기 가능)
- 환자 목록: 검색(이름/보호자/종), 선택
- 환자 상세: 기본정보 + 보호자 + 의뢰 1차병원 + 회차 목록
- 진료 회차: 생성/조회, 진료 텍스트, 회차별 첨부
  - 처방: 약품 마스터에서 선택 + 용량/용법
  - 의료영상 업로드/조회 (일반 이미지 미리보기 + 원본 다운로드)
  - 일반 사진/영상 업로드/조회
- 약품 관리: 마스터 등록/수정/목록 (별도 화면)
- 입원 관리: 생성/종료, 바이털 입력, 바이털 시계열 그래프
- 초대 발급: 환자별 보호자 초대, 1차 병원 초대 (링크/코드)

### 외부 포털 (owner + referring_vet, 읽기 전용)
- 초대 링크/코드 → 로그인
- owner: 자기 반려동물의 회차·처방·영상·사진·입원/바이털 그래프 열람
- referring_vet: 자기 의뢰 환자 목록 → 상세 (동일 열람)

## 6. MVP 제외 (나중에)
- 예약/접수, 결제/청구
- 진료 텍스트 템플릿·서식, 전자서명
- DICOM 전문 뷰어 (MVP는 일반 이미지 미리보기 + 다운로드)
- 알림(문자/푸시), 채팅/문의
- 통계·리포트 대시보드
- 네이티브 모바일 앱 (MVP는 모바일 웹)
- 감사 로그, 데이터 내보내기

## 7. 열린 질문 / 추후 결정
- Storage 접근 방식: 서명 URL vs Storage RLS (구현 시 확정)
- 바이털 항목 최종 세트(체온/심박/호흡/혈압 외 추가 여부)
- 초대 코드 만료·재발급 정책 세부
