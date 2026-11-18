import { StreamerIdentity, GeneratedSocialMetadata } from '../types';
import { HashtagEngine } from '../hashtags/hashtagEngine';

export class MetadataEngine {
  /**
   * Resolve streamer identity strictly following the 5-tier priority hierarchy:
   * 1. Existing stream metadata
   * 2. Connected platform metadata
   * 3. User-provided streamer/channel input
   * 4. Explicit manual override
   * 5. Filename/transcript fallback only as last resort
   */
  static resolveStreamerIdentity(inputs: {
    streamMetadata?: { channel?: string; title?: string; uploader?: string; handle?: string; url?: string };
    connectedPlatform?: { channelName?: string; handle?: string };
    userInput?: { streamerName?: string; streamerHandle?: string; gameOrTopic?: string };
    manualOverride?: { streamerName?: string; streamerHandle?: string; gameOrTopic?: string };
    filenameOrTranscriptClue?: string;
  }): StreamerIdentity {
    // Priority 4: Explicit manual override
    if (inputs.manualOverride?.streamerName && inputs.manualOverride.streamerName.trim()) {
      return {
        streamerName: inputs.manualOverride.streamerName.trim(),
        streamerHandle: inputs.manualOverride.streamerHandle?.trim() || `@${inputs.manualOverride.streamerName.toLowerCase().replace(/\s+/g, '')}`,
        channelName: inputs.manualOverride.streamerName.trim(),
        originalTitle: inputs.streamMetadata?.title || '',
        gameOrTopic: inputs.manualOverride.gameOrTopic || inputs.streamMetadata?.title?.split('|')[0]?.trim() || 'Gaming',
        sourcePlatform: 'manual_override',
        streamUrl: inputs.streamMetadata?.url,
        detectionSource: 'manual_override',
        verified: true
      };
    }

    // Priority 1: Existing stream metadata from URL / yt-dlp
    if (inputs.streamMetadata?.channel && inputs.streamMetadata.channel.trim()) {
      const rawChannel = inputs.streamMetadata.channel.trim();
      const cleanName = rawChannel.split('(')[0].replace(/[@\(\)]/g, '').trim() || rawChannel;
      return {
        streamerName: cleanName,
        streamerHandle: inputs.streamMetadata.handle || `@${cleanName.toLowerCase().replace(/\s+/g, '')}`,
        channelName: rawChannel,
        originalTitle: inputs.streamMetadata.title || '',
        gameOrTopic: this.detectGameOrTopic(inputs.streamMetadata.title || ''),
        sourcePlatform: 'youtube',
        streamUrl: inputs.streamMetadata.url,
        detectionSource: 'stream_metadata',
        verified: true
      };
    }

    // Priority 2: Connected platform metadata
    if (inputs.connectedPlatform?.channelName && inputs.connectedPlatform.channelName.trim()) {
      return {
        streamerName: inputs.connectedPlatform.channelName.trim(),
        streamerHandle: inputs.connectedPlatform.handle || `@${inputs.connectedPlatform.channelName.toLowerCase().replace(/\s+/g, '')}`,
        channelName: inputs.connectedPlatform.channelName.trim(),
        originalTitle: inputs.streamMetadata?.title || '',
        gameOrTopic: 'Gaming',
        sourcePlatform: 'connected_platform',
        streamUrl: inputs.streamMetadata?.url,
        detectionSource: 'connected_platform',
        verified: true
      };
    }

    // Priority 3: Existing user-provided input
    if (inputs.userInput?.streamerName && inputs.userInput.streamerName.trim()) {
      const clean = inputs.userInput.streamerName.trim();
      return {
        streamerName: clean,
        streamerHandle: inputs.userInput.streamerHandle || `@${clean.toLowerCase().replace(/\s+/g, '')}`,
        channelName: clean,
        originalTitle: inputs.streamMetadata?.title || '',
        gameOrTopic: inputs.userInput.gameOrTopic || 'Gaming',
        sourcePlatform: 'user_input',
        streamUrl: inputs.streamMetadata?.url,
        detectionSource: 'user_input',
        verified: true
      };
    }

    // Priority 5: Last resort filename/transcript clue
    const clue = inputs.filenameOrTranscriptClue || 'Creator';
    return {
      streamerName: clue,
      streamerHandle: `@${clue.toLowerCase().replace(/\s+/g, '')}`,
      channelName: clue,
      originalTitle: '',
      gameOrTopic: 'Gaming Highlights',
      sourcePlatform: 'local_upload',
      detectionSource: 'transcript_fallback',
      verified: false
    };
  }

  private static detectGameOrTopic(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('gta vi') || t.includes('gta 6')) return 'GTA VI';
    if (t.includes('gta v') || t.includes('gta 5')) return 'GTA V';
    if (t.includes('bgmi')) return 'BGMI';
    if (t.includes('pubg')) return 'PUBG Mobile';
    if (t.includes('minecraft')) return 'Minecraft';
    if (t.includes('valorant')) return 'Valorant';
    if (t.includes('free fire') || t.includes('freefire')) return 'Free Fire';
    if (t.includes('podcast')) return 'Podcast';
    return 'Gaming Stream Highlight';
  }

  /**
   * Generate comprehensive platform-specific metadata for a clip
   */
  static generateClipMetadata(options: {
    clipId: string;
    streamer: StreamerIdentity;
    headlineHook?: string;
    transcript?: string;
    gameOrTopic?: string;
    duration?: number;
    privacy?: 'public' | 'unlisted' | 'private';
  }): GeneratedSocialMetadata {
    const { clipId, streamer, headlineHook, transcript = '', duration = 30, privacy = 'public' } = options;

    const creatorName = streamer.streamerName || 'Creator';
    const topic = streamer.gameOrTopic || options.gameOrTopic || 'Gaming';
    const hook = headlineHook || 'UNREAL STREAM MOMENT';

    // Generate Curated Hashtag Groups
    const hashtagResult = HashtagEngine.generateHashtags({
      streamer,
      topic,
      dialogueTranscript: transcript,
      hookHeadline: hook,
      platform: 'both'
    });

    // 1. YouTube Shorts Package
    const youtubeTitle = `${creatorName} ${hook} 😂🔥 #shorts`.slice(0, 95);
    const alternativeTitles = [
      `${creatorName} Lost His Mind Here! 😱 #shorts`,
      `When ${creatorName} Did This On Live Stream! 💀 #shorts`,
      `${hook} - ${creatorName} Special #shorts`,
      `Nobody Expected ${creatorName} To Do This! 😂 #shorts`
    ];

    const youtubeDescription = `${creatorName} has an unreal reaction live on stream! 😂🔥

🎮 Game / Stream: ${topic}
🎙️ Creator: ${creatorName} (${streamer.streamerHandle || '@' + creatorName.toLowerCase().replace(/\s+/g, '')})
💬 Moment: "${hook}"
⏱️ Duration: ${Math.round(duration)}s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔔 Subscribe for daily viral stream highlights, funny fails and epic clutches!
👍 Drop a LIKE if this clip made your day!

${hashtagResult.platformRelevant.join(' ')} ${hashtagResult.streamerSpecific.join(' ')} ${hashtagResult.gameOrTopic.join(' ')} ${hashtagResult.contentSpecific.join(' ')}`;

    // YouTube tags (comma-separated keywords for algorithm)
    const youtubeTags = [
      creatorName,
      creatorName.toLowerCase(),
      topic,
      'shorts',
      'youtube shorts',
      'viral shorts',
      'stream highlight',
      'funny moments',
      'gaming clips',
      'best moments'
    ];

    const suggestedPinnedComment = `What was your favorite moment from ${creatorName}'s stream? Comment below! 👇🔥`;
    const suggestedThumbnailText = hook.toUpperCase();

    // 2. Instagram Reels Package
    const instagramCaption = `${hook} 🔥💀

${creatorName} being legendary as always! Tag a friend who needs to see this 😂👇

Drop a '🔥' in comments if you caught this live!
.
.
.
${hashtagResult.allCombined.slice(0, 15).join(' ')}`;

    return {
      clipId,
      streamer,
      youtube: {
        title: youtubeTitle,
        alternativeTitles,
        description: youtubeDescription,
        tags: youtubeTags,
        category: '20', // YouTube Gaming category
        categoryName: 'Gaming',
        suggestedPinnedComment,
        callToAction: `Subscribe to ${creatorName} and like for more daily highlights!`,
        suggestedThumbnailText,
        attributionText: `Original gameplay & broadcast by ${creatorName}`
      },
      instagram: {
        caption: instagramCaption,
        hashtags: hashtagResult.allCombined.slice(0, 15),
        shortHook: hook,
        creatorAttribution: streamer.streamerHandle || `@${creatorName.toLowerCase().replace(/\s+/g, '')}`,
        callToAction: 'Follow for daily Reels & share with your squad!',
        suggestedFirstComment: `Watch full stream on ${creatorName}'s official channel! 🔥`,
        shareToFeed: true
      },
      hashtags: hashtagResult,
      privacy,
      generatedAt: new Date().toISOString()
    };
  }
}
