import classNames from "classnames";
import { useRouter } from "next/router";
import { useState } from "react";
import Button from "./Button";
import TextInput from "./TextInput";

const THEMES = ["default", "minimal", "magazine", "newspaper", "academic"];

function CreateFeedForm() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [theme, setTheme] = useState("default");
  const [maxArticles, setMaxArticles] = useState(10);
  const [fetchFullContent, setFetchFullContent] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [error, setError] = useState("");

  const handleCreateFeed = async () => {
    try {
      const response = await fetch("/api/user/feed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          theme,
          maxArticles,
          fetchFullContent,
          includeImages,
        }),
      });
      switch (response.status) {
        case 201:
          router.reload();
          break;
        case 400:
          setError("Please check the URL");
          break;
        case 409:
          setError("This feed already exists");
          break;
        default:
          setError("Server Error");
          break;
      }
    } catch (e: any) {
      console.log(e);
    }
  };

  return (
    <div>
      <h3 className={classNames("font-bold", "text-xl", "mb-2")}>
        Add new feed
      </h3>
      <TextInput
        placeholder="feed url"
        value={url}
        onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
      />
      <div className={classNames("flex", "gap-2", "mb-2")}>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className={classNames(
            "flex-1",
            "p-2",
            "text-center",
            "border",
            "border-gray-400",
            "focus:border-black",
            "outline-none"
          )}
        >
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={50}
          value={maxArticles}
          onChange={(e) => setMaxArticles(parseInt(e.target.value) || 10)}
          className={classNames(
            "w-20",
            "p-2",
            "text-center",
            "border",
            "border-gray-400",
            "focus:border-black",
            "outline-none"
          )}
          title="Max articles"
        />
      </div>
      <div
        className={classNames(
          "flex",
          "gap-4",
          "justify-center",
          "mb-2",
          "text-sm"
        )}
      >
        <label className={classNames("select-none", "cursor-pointer")}>
          <input
            type="checkbox"
            checked={fetchFullContent}
            onChange={(e) => setFetchFullContent(e.target.checked)}
            className={classNames("mr-1")}
          />
          Full content
        </label>
        <label className={classNames("select-none", "cursor-pointer")}>
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
            className={classNames("mr-1")}
          />
          Include images
        </label>
      </div>
      <Button label="Add +" onClick={handleCreateFeed} />
      <p className={classNames("my-2", "text-red-700", "text-sm")}>{error}</p>
    </div>
  );
}

export default CreateFeedForm;
