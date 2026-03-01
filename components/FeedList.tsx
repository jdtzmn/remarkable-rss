import classNames from "classnames";
import { useRouter } from "next/router";
import { useState } from "react";

type Props = {
  feeds: {
    url: string;
    title: string;
    _id: string;
    theme?: string;
    maxArticles?: number;
    fetchFullContent?: boolean;
    includeImages?: boolean;
  }[];
};

function FeedList(props: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const handleDeleteFeed = async (id: string) => {
    try {
      const response = await fetch("/api/user/feed/" + id, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      switch (response.status) {
        case 200:
          router.reload();
          break;
        case 401:
          setError("Authentication Error");
          break;
        case 404:
          setError("Feed not found");
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
    <div className={classNames("mb-5")}>
      <h3 className={classNames("font-bold", "text-xl", "mb-2")}>
        Your Feeds
      </h3>
      {error && <p className={classNames("text-red-500")}>{error}</p>}
      {props.feeds.map((feed, i) => (
        <div
          key={i}
          className={classNames(
            "bg-gray-100",
            "border",
            "border-gray-400",
            "p-2",
            "mb-2",
            "text-left"
          )}
        >
          <div className={classNames("flex", "justify-between", "items-start")}>
            <div>
              <p className={classNames("font-bold")}>{feed.title}</p>
              <p className={classNames("font-mono", "text-sm", "text-gray-600")}>
                {feed.url}
              </p>
            </div>
            <span
              className={classNames(
                "text-xs",
                "bg-gray-200",
                "border",
                "border-gray-400",
                "px-2",
                "py-1",
                "rounded",
                "whitespace-nowrap",
                "ml-2"
              )}
            >
              {feed.theme || "default"}
            </span>
          </div>
          <div
            className={classNames(
              "flex",
              "gap-3",
              "mt-1",
              "text-xs",
              "text-gray-500"
            )}
          >
            <span>max: {feed.maxArticles || 10}</span>
            {feed.fetchFullContent !== false && <span>full content</span>}
            {feed.includeImages !== false && <span>images</span>}
          </div>
          <p
            className={classNames(
              "text-red-700",
              "active:text-black",
              "select-none",
              "cursor-pointer",
              "inline-block",
              "text-sm",
              "mt-1"
            )}
            onClick={() => handleDeleteFeed(feed._id)}
          >
            delete
          </p>
        </div>
      ))}
    </div>
  );
}

export default FeedList;
