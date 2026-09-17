"use client";

import { UploadSimple } from "@phosphor-icons/react/ssr";
import { useRef, useState } from "react";

/** A real file input styled as a drop zone. Dropped files are assigned to the input. */
export function LogoDropZone() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`drop-zone${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = event.dataTransfer.files;
        if (!files?.length || !input.current) return;
        try {
          input.current.files = files;
        } catch {
          // Some test environments don't allow assigning FileList; the name still shows.
        }
        setFileName(files[0].name);
      }}
    >
      <input
        ref={input}
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp"
        required
        className="visually-hidden"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <UploadSimple size={22} weight="duotone" aria-hidden="true" />
      <span>
        <b>Upload a logo</b> or drag it here
      </span>
      <small>{fileName || "PNG, JPEG or WebP, up to 256 KB"}</small>
    </label>
  );
}
