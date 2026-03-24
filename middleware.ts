export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
  ],
};
