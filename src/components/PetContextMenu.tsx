import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PetAction, PetActionContext } from '../pet/types';

interface PetContextMenuProps {
  actions: PetAction[];
  context: PetActionContext;
  x: number;
  y: number;
  onClose: () => void;
}

export function PetContextMenu({ actions, context, x, y, onClose }: PetContextMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const expressionTriggerRef = useRef<HTMLButtonElement>(null);
  const closeExpressionTimerRef = useRef<number | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    left: x,
    top: y,
  });
  const [isExpressionMenuOpen, setIsExpressionMenuOpen] = useState(false);
  const [expressionMenuStyle, setExpressionMenuStyle] = useState<CSSProperties>({});
  const expressionActions = actions.filter((action) => action.group === 'expression');
  const primaryActions = actions.filter((action) => action.group !== 'expression');
  const primaryActionsBeforeExpression = primaryActions.slice(0, 2);
  const primaryActionsAfterExpression = primaryActions.slice(2);

  function clearExpressionCloseTimer() {
    if (closeExpressionTimerRef.current !== null) {
      window.clearTimeout(closeExpressionTimerRef.current);
      closeExpressionTimerRef.current = null;
    }
  }

  function scheduleExpressionMenuClose() {
    clearExpressionCloseTimer();
    // WHY: 父菜单和二级菜单之间有移动间隙，延迟关闭能避免用户还没点到表情菜单就被收起。
    closeExpressionTimerRef.current = window.setTimeout(() => {
      setIsExpressionMenuOpen(false);
      closeExpressionTimerRef.current = null;
    }, 1000);
  }

  function updateExpressionMenuPosition() {
    const containerElement = containerRef.current;
    const menuElement = menuRef.current;
    const triggerElement = expressionTriggerRef.current;
    if (!containerElement || !menuElement || !triggerElement) {
      return;
    }

    const viewportGap = 8;
    const submenuWidth = 136;
    const containerRect = containerElement.getBoundingClientRect();
    const menuRect = menuElement.getBoundingClientRect();
    const triggerRect = triggerElement.getBoundingClientRect();
    const shouldOpenLeft = menuRect.right + submenuWidth + viewportGap > window.innerWidth;
    const top = Math.min(
      Math.max(triggerRect.top - containerRect.top, 0),
      Math.max(0, window.innerHeight - containerRect.top - viewportGap - expressionActions.length * 34),
    );

    setExpressionMenuStyle({
      left: shouldOpenLeft ? -submenuWidth + 2 : menuRect.width - 2,
      top,
      width: submenuWidth,
      maxHeight: Math.max(96, window.innerHeight - viewportGap * 2),
    });
  }

  function openExpressionMenu() {
    clearExpressionCloseTimer();
    updateExpressionMenuPosition();
    setIsExpressionMenuOpen(true);
  }

  useEffect(() => {
    return () => clearExpressionCloseTimer();
  }, []);

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const viewportGap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = menuElement.getBoundingClientRect();
    const maxMenuHeight = Math.max(96, viewportHeight - viewportGap * 2);
    const clampedLeft = Math.min(Math.max(x, viewportGap), Math.max(viewportGap, viewportWidth - menuRect.width - viewportGap));
    const clampedTop = Math.min(Math.max(y, viewportGap), Math.max(viewportGap, viewportHeight - menuRect.height - viewportGap));

    setMenuStyle({
      left: clampedLeft,
      top: clampedTop,
      maxHeight: maxMenuHeight,
    });
  }, [x, y, actions.length]);

  return (
    <div
      ref={containerRef}
      className="pet-menu-container"
      style={menuStyle}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onMouseEnter={clearExpressionCloseTimer}
      onMouseLeave={scheduleExpressionMenuClose}
    >
      <div
        ref={menuRef}
        className="pet-menu"
        // WHY: 桌面宠物窗口本身不可滚动，菜单必须吃掉滚轮事件，否则内容被窗口 overflow 裁掉后无法操作。
      >
        {primaryActionsBeforeExpression.map((action) => (
          <button
            key={action.id}
            className="pet-menu-item"
            type="button"
            onClick={async () => {
              await action.run(context);
              onClose();
            }}
          >
            {action.label}
          </button>
        ))}

        {expressionActions.length > 0 && (
          <button
            ref={expressionTriggerRef}
            className="pet-menu-item pet-menu-item-submenu"
            type="button"
            aria-haspopup="menu"
            aria-expanded={isExpressionMenuOpen}
            onMouseEnter={openExpressionMenu}
            onFocus={openExpressionMenu}
          >
            <span>表情</span>
            <span className="pet-menu-submenu-arrow">›</span>
          </button>
        )}

        {primaryActionsAfterExpression.map((action) => (
          <button
            key={action.id}
            className="pet-menu-item"
            type="button"
            onClick={async () => {
              await action.run(context);
              onClose();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {isExpressionMenuOpen && expressionActions.length > 0 && (
        <div
          className="pet-menu pet-menu-submenu"
          style={expressionMenuStyle}
          role="menu"
          onMouseEnter={clearExpressionCloseTimer}
          onMouseLeave={scheduleExpressionMenuClose}
        >
          {expressionActions.map((action) => (
            <button
              key={action.id}
              className="pet-menu-item"
              type="button"
              onClick={async () => {
                await action.run(context);
                onClose();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
