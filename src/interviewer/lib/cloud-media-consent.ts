export function shouldSendCloudMedia({
  consent,
  mediaAvailable,
  interviewReady,
}: {
  consent: boolean;
  mediaAvailable: boolean;
  interviewReady: boolean;
}) {
  return consent && mediaAvailable && interviewReady;
}
