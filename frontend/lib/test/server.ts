import { setupServer } from "msw/node";

// 테스트마다 server.use(...)로 핸들러를 넣는다.
// 핸들러가 없는 요청은 MSW가 fetch를 거부하고 로그만 남긴다. 그 자체로 테스트가 실패하지는 않고,
// 테스트 대상 코드가 그 오류를 화면에 드러낼 때만 실패한다.
// 따라서 "요청이 가지 않았다"나 "정확히 한 번 갔다"는 핸들러의 플래그나 카운터로 직접 확인한다.
export const server = setupServer();
