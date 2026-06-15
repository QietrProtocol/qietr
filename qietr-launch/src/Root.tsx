import "./index.css";
import { Composition } from "remotion";
import { Launch } from "./Launch";
import { W, H, FPS } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Launch"
        component={Launch}
        durationInFrames={1740} /* full film: 8 scenes @ 30fps = 58s */
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
