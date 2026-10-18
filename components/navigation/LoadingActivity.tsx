"use client";
import { useNavigationActivity } from "./NavigationProvider";
export default function LoadingActivity() { useNavigationActivity(true, "画面"); return null; }
