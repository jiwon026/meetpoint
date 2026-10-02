import { setupServer } from "msw/node";

// 테스트마다 server.use(...)로 핸들러를 넣는다. 가로채지 않은 요청은 테스트를 실패시킨다.
export const server = setupServer();
