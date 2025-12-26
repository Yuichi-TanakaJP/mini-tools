import { Suspense } from "react";
import ShareButtons from "./ShareButtons";

type Props = React.ComponentProps<typeof ShareButtons>;

export default function ShareButtonsSuspended(props: Props) {
  return (
    <Suspense fallback={null}>
      <ShareButtons {...props} />
    </Suspense>
  );
}
