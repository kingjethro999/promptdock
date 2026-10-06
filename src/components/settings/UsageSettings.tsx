"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import UsageMeter, { type Usage } from "./UsageMeter";

export default function UsageSettings() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api<{ usage: Usage[] }>("/api/usage")
      .then((value) => setUsage(value.usage))
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, []);

  return <UsageMeter usage={usage} loading={loading} error={notice} />;
}
