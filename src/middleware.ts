import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/uploadthing(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:13',message:'Middleware entry',data:{url:req.url,pathname:req.nextUrl.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  
  try {
    const isPublic = isPublicRoute(req);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:18',message:'Route check',data:{isPublic,pathname:req.nextUrl.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!isPublic) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:22',message:'Before auth call',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion
      
      const { userId } = await auth();
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:26',message:'After auth call',data:{userId:userId||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion
      
      if (!userId) {
        const signInUrl = new URL("/sign-in", req.url);
        signInUrl.searchParams.set("redirect_url", req.url);
        return NextResponse.redirect(signInUrl);
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:38',message:'Middleware success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/95238550-d0b8-43ea-8c9b-d8d447bc1b58',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:42',message:'Middleware error',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:''},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    throw error;
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
