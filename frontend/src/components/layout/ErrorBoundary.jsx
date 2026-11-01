// Catches render errors in a page so one broken screen shows a message and a
// way out instead of blanking the whole app.
import { Component } from 'react';
import Icon from '../ui/Icon.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state-page" role="alert">
        <div className="empty-icon"><Icon name="error" size={22} /></div>
        <h1 style={{ fontSize: 20 }}>This page hit an error</h1>
        <p>Something went wrong while showing this page. Reloading usually fixes it; your data is safe.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          <Icon name="refresh" size={16} /> Reload page
        </button>
      </div>
    );
  }
}
