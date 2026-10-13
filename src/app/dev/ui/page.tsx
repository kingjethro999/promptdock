"use client";

import React, { useState } from "react";
import { notFound } from "next/navigation";
import {
  Button,
  IconButton,
  LinkButton,
  TextField,
  PasswordField,
  TextArea,
  SearchInput,
  Select,
  Checkbox,
  Radio,
  RadioGroup,
  ChoiceCard,
  Switch,
  FileButton,
  Icon,
  Glyph,
} from "@/components/ui";

const sampleOptions = [
  { value: "gpt-4o", label: "OpenAI GPT-4o", description: "Flagship omni model" },
  { value: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", description: "Hybrid reasoning" },
  { value: "gemini-2-5-pro", label: "Gemini 2.5 Pro", description: "Deep analysis" },
  { value: "deepseek-r1", label: "DeepSeek R1", description: "Open weights reasoning", disabled: true },
];

export default function DevUIGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [textVal, setTextVal] = useState("PromptDock Creator");
  const [passwordVal, setPasswordVal] = useState("SecretPassword123!");
  const [textAreaVal, setTextAreaVal] = useState("Generate an autonomous workflow...");
  const [searchVal, setSearchVal] = useState("community");
  const [selectVal, setSelectVal] = useState<string | null>("claude-3-7-sonnet");
  const [checked, setChecked] = useState(true);
  const [radioVal, setRadioVal] = useState("option1");
  const [choiceVal, setChoiceVal] = useState("public");
  const [switchVal, setSwitchVal] = useState(true);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ui-bg)",
        color: "var(--ui-fg)",
        padding: "32px 24px 64px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
            borderBottom: "1px solid var(--ui-border)",
            paddingBottom: "16px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 4px" }}>
              PromptDock UI Kit Gallery
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--ui-placeholder)" }}>
              Dev-only surface demonstrating every primitive across themes and states
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={theme === "light" ? "moon" : "sun"}
              onClick={toggleTheme}
            >
              Switch to {theme === "light" ? "Dark" : "Light"}
            </Button>
          </div>
        </div>

        {/* 1. Buttons */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            1. Buttons & Icon Buttons
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <Button variant="primary" leadingIcon="sparkles">
              Primary Action
            </Button>
            <Button variant="secondary" leadingIcon="bookmark">
              Secondary Button
            </Button>
            <Button variant="ghost" leadingIcon="share">
              Ghost Button
            </Button>
            <Button variant="danger" leadingIcon="trash">
              Danger Button
            </Button>
            <Button variant="primary" loading>
              Loading State
            </Button>
            <Button variant="secondary" disabled>
              Disabled Button
            </Button>
            <LinkButton href="/community" variant="secondary" trailingIcon="arrow-up-right">
              Link Button
            </LinkButton>
            <IconButton icon="copy" aria-label="Copy to clipboard" />
            <IconButton icon="heart" aria-label="Favorite item" />
            <IconButton icon="settings" aria-label="Open settings" size="sm" />
          </div>
        </section>

        {/* 2. Glyphs vs Emojis */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            2. Brand Glyphs (Adaptive Vector Geometry)
          </h2>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="spark" size={18} />
              <span>Spark (✳)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="star" size={18} />
              <span>Star (✦)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="arrow-up-right" size={18} />
              <span>Arrow (↗)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="command" size={18} />
              <span>Command (⌘)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="pencil" size={18} />
              <span>Pencil (✎)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Glyph name="check" size={18} />
              <span>Check (✓)</span>
            </div>
          </div>
        </section>

        {/* 3. Text Fields */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            3. Text Fields & Password
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <TextField
              label="Standard Text Field"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              hint="Enter your public display handle"
            />
            <TextField
              label="Field with Error"
              value="invalid_handle!"
              error="Username can only contain letters, numbers, and dashes"
            />
            <TextField
              label="Disabled Field"
              value="system_reserved"
              disabled
              hint="This value is immutable"
            />
            <PasswordField
              label="Password Field"
              value={passwordVal}
              onChange={(e) => setPasswordVal(e.target.value)}
              hint="Minimum 8 characters with at least one number"
            />
          </div>
        </section>

        {/* 4. Search & Select */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            4. Search & Select Listbox
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Search Input
              </label>
              <SearchInput
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search templates, creators..."
              />
            </div>
            <Select
              label="Model Select (Portal & Keyboard)"
              value={selectVal}
              onChange={setSelectVal}
              options={sampleOptions}
              searchable
              hint="Select your preferred default language model"
            />
            <Select
              label="Disabled Select"
              value="gpt-4o"
              onChange={() => {}}
              options={sampleOptions}
              disabled
              hint="Provider selection is locked"
            />
          </div>
        </section>

        {/* 5. Choice Cards, Radios, Checkbox & Switch */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            5. Selection Controls (Check, Radio, Switch, Choice Cards)
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            <div style={{ display: "grid", gap: "16px" }}>
              <Checkbox
                label="List prompt in community explorer"
                hint="Makes your prompt searchable in the global public feed"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <Switch
                label="Observed execution streaming"
                hint="Stream agent thoughts and tool outputs in real-time"
                checked={switchVal}
                onChange={(e) => setSwitchVal(e.target.checked)}
              />
              <RadioGroup
                label="Audience Scope"
                name="scope"
                value={radioVal}
                onChange={setRadioVal}
              >
                <Radio value="option1" label="Personal Only" hint="Accessible only by your account" />
                <Radio value="option2" label="Team Workspace" hint="Shared with team members" />
              </RadioGroup>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <ChoiceCard
                name="privacy"
                value="public"
                checked={choiceVal === "public"}
                onChange={setChoiceVal}
                title="Public (Everyone)"
                description="Anyone on the web can find and remix this prompt"
                icon={<Icon name="users" size={16} />}
              />
              <ChoiceCard
                name="privacy"
                value="followers"
                checked={choiceVal === "followers"}
                onChange={setChoiceVal}
                title="Followers Only"
                description="Only registered users following your profile"
                icon={<Icon name="bookmark" size={16} />}
              />
              <ChoiceCard
                name="privacy"
                value="private"
                checked={choiceVal === "private"}
                onChange={setChoiceVal}
                title="Private"
                description="Only visible and executable by you"
                icon={<Icon name="shield" size={16} />}
              />
            </div>
          </div>
        </section>

        {/* 6. Text Area & File Button */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            6. TextArea & File Button
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            <TextArea
              label="Prompt System Instructions"
              value={textAreaVal}
              onChange={(e) => setTextAreaVal(e.target.value)}
              autoGrow
              maxLength={200}
              hint="Define persona and tone constraints"
            />
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                File Upload Trigger
              </label>
              <FileButton
                accept="image/*"
                leadingIcon="upload"
                onFileSelect={(file) => alert(`Selected file: ${file.name}`)}
              >
                Upload Profile Picture
              </FileButton>
            </div>
          </div>
        </section>

        {/* 7. Overflow & Dialog Clipping Check */}
        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
            7. Overflow: Hidden Card Containment
          </h2>
          <div
            style={{
              overflow: "hidden",
              border: "1px solid var(--ui-border)",
              borderRadius: "12px",
              padding: "20px",
              background: "var(--ui-bg)",
              maxWidth: "400px",
            }}
          >
            <p style={{ fontSize: "13px", color: "var(--ui-placeholder)", margin: "0 0 12px" }}>
              This card has <code>overflow: hidden</code>. The Select portal renders to <code>document.body</code> so its options are never clipped!
            </p>
            <Select
              label="Select Inside Overflow Hidden"
              value={selectVal}
              onChange={setSelectVal}
              options={sampleOptions}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
