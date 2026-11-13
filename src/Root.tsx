import { Composition, Folder } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { Title } from "./HelloWorld/Title";
import AudioTest from "./compositions/AudioTest";
import CinematicDocumentary from "./compositions/CinematicDocumentary";
import { AIBubbleReel } from "./compositions/AIBubbleReel";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Documentary-System">
        <Composition
          id="CinematicDocumentary"
          component={CinematicDocumentary}
          durationInFrames={1800}
          fps={30}
          width={1920}
          height={1080}
          calculateMetadata={({ props }) => {
            const scenes = (props as any)?.scenes || [];
            const lastSceneEnd = scenes.length > 0 ? (scenes[scenes.length - 1].startFrame + scenes[scenes.length - 1].durationFrames) : 0;
            const cues = (props as any)?.subtitlesData?.cues || [];
            const lastCueEnd = cues.length > 0 ? cues[cues.length - 1].endFrame : 0;
            const dur = (props as any)?.durationInFrames || Math.max(lastSceneEnd, lastCueEnd, 900);
            return {
              durationInFrames: Math.max(90, dur),
            };
          }}
          defaultProps={{
            title: "THE STRAIT OF HORMUZ: THE WORLD'S DEADLIEST CHOKEPOINT",
            subtitle: "Strategic Geography • Maritime Routes • Global Energy Balance",
            category: "Geopolitics",
            topic: "Strait of Hormuz",
            narrationSrc: "/audio/narration.wav",
            musicSrc: "/audio/bgm/epic_geopolitics.wav",
          }}
        />
        <Composition
          id="AudioTest"
          component={AudioTest}
          durationInFrames={900}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            narrationSrc: "/audio/narration.wav",
            musicSrc: "/audio/background-music.wav",
            subtitlesSrc: "/subtitles.srt",
          }}
        />
        <Composition
          id="AIBubbleReel"
          component={AIBubbleReel}
          durationInFrames={1572}
          fps={30}
          width={1080}
          height={1920}
          calculateMetadata={({ props }) => {
            const dur = (props as any)?.durationInFrames || 1572;
            return { durationInFrames: dur };
          }}
          defaultProps={{
            narrationSrc: "/audio/ai_bubble_mastered.wav",
            musicSrc: "/audio/bgm/tech_cyber.wav",
          }}
        />
      </Folder>
      <Folder name="Elements">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            logoColor1: "#91EAE4",
            logoColor2: "#86A8E7",
          }}
        />
        <Composition
          id="Title"
          component={Title}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            titleText: "Welcome to Remotion",
            titleColor: "#000000",
          }}
        />
      </Folder>
      <Composition
        // You can take the "id" to render a video:
        // bunx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />
    </>
  );
};