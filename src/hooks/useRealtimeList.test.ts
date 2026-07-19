import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// 채널 목 — 등록된 postgres_changes 핸들러를 테스트에서 직접 호출해 이벤트를 흉내낸다.
const mocks = vi.hoisted(() => {
  interface FakeChannel {
    topic: string;
    handlers: Array<() => void>;
    on: (ev: string, cfg: unknown, cb: () => void) => FakeChannel;
    subscribe: () => FakeChannel;
  }
  const channels: FakeChannel[] = [];
  const removeChannel = vi.fn();
  const channel = (topic: string): FakeChannel => {
    const ch: FakeChannel = {
      topic,
      handlers: [],
      on(_ev, _cfg, cb) {
        ch.handlers.push(cb);
        return ch;
      },
      subscribe: () => ch,
    };
    channels.push(ch);
    return ch;
  };
  return { channels, removeChannel, channel };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { channel: mocks.channel, removeChannel: mocks.removeChannel },
}));

const { useRealtimeList } = await import("@/hooks/useRealtimeList");

// COALESCE_MS(350) + jitter(0~400). Math.random 을 고정해 대기 시간을 결정적으로 만든다.
const COALESCE_MS = 350;
const MAX_JITTER_MS = 400;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

function mount(table: string, fetcher: () => Promise<unknown[]>) {
  const root = createRoot(document.createElement("div"));
  roots.push(root);
  const Probe = () => {
    useRealtimeList(table, fetcher);
    return null;
  };
  act(() => root.render(createElement(Probe)));
  return root;
}

// 이벤트 창(coalesce + 최대 지터)을 모두 지나가게 하고 대기 중인 promise 를 비운다.
async function flushWindow() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(COALESCE_MS + MAX_JITTER_MS + 10);
  });
}

function emit(index = 0) {
  for (const cb of mocks.channels[index].handlers) cb();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  mocks.channels.length = 0;
  mocks.removeChannel.mockClear();
});

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRealtimeList", () => {
  it("마운트 시 한 번만 조회한다", async () => {
    const fetcher = vi.fn(async () => []);
    mount("teams", fetcher);
    await act(async () => {});

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("연속 이벤트를 한 번의 리페치로 합친다", async () => {
    const fetcher = vi.fn(async () => []);
    mount("teams", fetcher);
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 스태프 여러 명이 몰아서 입력한 상황 — 이벤트 5개가 창 안에 들어온다
    for (let i = 0; i < 5; i++) emit();
    await flushWindow();

    expect(fetcher).toHaveBeenCalledTimes(2); // 마운트 1 + 합쳐진 리페치 1
  });

  it("창이 닫힌 뒤의 이벤트는 새 리페치를 만든다", async () => {
    const fetcher = vi.fn(async () => []);
    mount("teams", fetcher);
    await act(async () => {});

    emit();
    await flushWindow();
    emit();
    await flushWindow();

    expect(fetcher).toHaveBeenCalledTimes(3); // 마운트 1 + 창 2개
  });

  it("이벤트 전에는 타이머를 걸지 않는다", async () => {
    const fetcher = vi.fn(async () => []);
    mount("teams", fetcher);
    await act(async () => {});

    await flushWindow();

    expect(fetcher).toHaveBeenCalledTimes(1); // 조용하면 추가 조회 없음
  });

  it("리페치 지연에 지터가 섞인다", async () => {
    const fetcher = vi.fn(async () => []);
    mount("teams", fetcher);
    await act(async () => {});

    vi.mocked(Math.random).mockReturnValue(1); // 최대 지터 → 750ms 대기
    emit();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COALESCE_MS + MAX_JITTER_MS - 10);
    });
    expect(fetcher).toHaveBeenCalledTimes(1); // 아직 안 됨 — 지터가 실제로 더해졌다

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("요청이 떠 있는 동안 들어온 이벤트는 끝난 뒤 한 번만 재조회한다", async () => {
    let release: (v: unknown[]) => void = () => {};
    const fetcher = vi
      .fn<() => Promise<unknown[]>>()
      .mockImplementationOnce(async () => [])
      .mockImplementationOnce(() => new Promise<unknown[]>((r) => (release = r)))
      .mockImplementation(async () => []);

    mount("teams", fetcher);
    await act(async () => {});

    emit();
    await flushWindow(); // 2번째 호출 시작 — 아직 응답 없음
    expect(fetcher).toHaveBeenCalledTimes(2);

    // 응답을 기다리는 동안 이벤트가 3개 더 들어온다
    for (let i = 0; i < 3; i++) emit();
    await flushWindow();
    expect(fetcher).toHaveBeenCalledTimes(2); // 중복 동시 요청 없음

    await act(async () => {
      release([]);
    });
    await flushWindow();
    expect(fetcher).toHaveBeenCalledTimes(3); // 밀린 이벤트는 딱 1회로 정리
  });

  it("같은 테이블을 두 번 구독해도 채널 토픽이 겹치지 않는다", async () => {
    mount("teams", async () => []);
    mount("teams", async () => []);
    await act(async () => {});

    const topics = mocks.channels.map((c) => c.topic);
    expect(topics).toHaveLength(2);
    expect(topics[0]).not.toBe(topics[1]);
    expect(topics.every((t) => t.startsWith("teams-changes-"))).toBe(true);
  });

  it("언마운트하면 채널을 정리하고 대기 중인 리페치를 취소한다", async () => {
    const fetcher = vi.fn(async () => []);
    const root = mount("teams", fetcher);
    await act(async () => {});

    emit();
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    await flushWindow();

    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1); // 예약돼 있던 리페치는 실행되지 않음
  });
});
