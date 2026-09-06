import { createContext, useContext, useEffect } from 'react';

/**
 * 몰입 모드 컨텍스트. App 이 setImmersive 를 내려주고, 복습 카드 화면이 켜져 있는 동안만 true 로 둔다.
 * 몰입 모드에서는 하단 탭 메뉴를 숨기고 App 레이아웃을 화면 높이(100dvh)에 고정해 카드 화면이 3단(헤더/본문/조작) 구조를 쓸 수 있게 한다.
 * 라우트(/review)만으로 판단하지 않는 이유: 복습 완료 화면은 같은 라우트인데 하단 메뉴가 다시 보여야 하기 때문이다.
 */
export const ImmersiveContext = createContext(() => {});

/** active 가 true 인 동안 몰입 모드를 켠다. 컴포넌트가 사라지면(뒤로 가기 등) 자동으로 끈다 */
export function useImmersive(active) {
  const setImmersive = useContext(ImmersiveContext);
  useEffect(() => {
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
