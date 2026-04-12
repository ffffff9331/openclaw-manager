import { Component, type ErrorInfo, type ReactNode } from "react";

interface PageErrorBoundaryProps {
  pageName: string;
  children: ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "页面渲染失败",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.pageName}] render failed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container">
          <div className="card">
            <div className="card-header">
              <h2>{this.props.pageName} 页面加载失败</h2>
            </div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <div>已拦截页面异常，避免整个应用白屏。</div>
              <div style={{ marginTop: 8 }}>错误信息：{this.state.message || "未知错误"}</div>
              <div style={{ marginTop: 12 }}>
                请先切换到其他页面，再返回重试；如果仍复现，再继续修这一页的具体逻辑。
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
