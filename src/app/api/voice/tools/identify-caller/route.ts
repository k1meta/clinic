import { identifyCaller } from '@/lib/voice/booking-service';
import { voiceTool } from '@/lib/voice/tool-route';

export const POST = voiceTool(async (ctx) => {
  const profile = await identifyCaller(ctx);
  return {
    ok: true,
    message: profile.message,
    data: { callerType: profile.callerType, firstName: profile.firstName },
  };
});
