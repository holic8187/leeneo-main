# V2 테스트 서버 실행

1. `.env.v2.example`을 `.env.v2`로 복사합니다.
2. `V2_MONGO_URI`에는 라이브 DB와 다른 테스트 전용 MongoDB를 입력합니다.
3. `npm run start:v2-test`를 실행합니다.
4. `http://localhost:5001/v2/`에서 확인합니다.

`.env.v2` 또는 `V2_MONGO_URI`가 없으면 테스트 서버는 실행되지 않습니다. 라이브 `MONGO_URI`로 자동 대체하지 않습니다.
