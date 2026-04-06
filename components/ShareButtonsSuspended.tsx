import { Suspense } from "react";
import ShareButtons from "./ShareButtons";

type Props = React.ComponentProps<typeof ShareButtons>;

function placeholderWidth(props: Props): number {
  const methods = props.methods ?? ["x", "facebook", "email", "copy"];
  const size = props.size ?? 44;
  const gap = props.inline ? 4 : 16;
  return methods.length * size + (methods.length - 1) * gap;
}

export default function ShareButtonsSuspended(props: Props) {
  const width = placeholderWidth(props);
  return (
    <Suspense
      fallback={
        <div
          style={{
            width,
            height: props.size ?? 44,
            marginTop: props.inline ? 0 : 12,
          }}
        />
      }
    >
      <ShareButtons {...props} />
    </Suspense>
  );
}
