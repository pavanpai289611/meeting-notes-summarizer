interface ErrorBannerProps {
  message: string | null;
}

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div role="alert" className="error-banner">
      <strong>Error:</strong> {message}
    </div>
  );
}
