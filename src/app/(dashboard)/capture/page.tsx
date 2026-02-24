"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, TextIcon } from "lucide-react";
import { CaptureUploader } from "./capture-uploader";
import { CaptureTextInput } from "./capture-text-input";

export default function CapturePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
        <p className="text-muted-foreground mt-1">
          Add Japanese learning materials from an image or text.
        </p>
      </div>

      <Tabs defaultValue="image" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <TextIcon className="h-4 w-4" />
            Paste Text
          </TabsTrigger>
        </TabsList>
        <TabsContent value="image">
          <CaptureUploader />
        </TabsContent>
        <TabsContent value="text">
          <CaptureTextInput />
        </TabsContent>
      </Tabs>
    </div>
  );
}
