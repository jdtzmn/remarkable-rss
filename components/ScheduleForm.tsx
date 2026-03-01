import classNames from "classnames";
import { useState } from "react";
import Button from "./Button";
import TextInput from "./TextInput";

type Props = {
  cronSchedule: string;
  cronEnabled: boolean;
};

function ScheduleForm(props: Props) {
  const [cronSchedule, setCronSchedule] = useState(props.cronSchedule);
  const [cronEnabled, setCronEnabled] = useState(props.cronEnabled);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      setSaved(false);
      setError("");
      const response = await fetch("/api/user/schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cronSchedule, cronEnabled }),
      });
      switch (response.status) {
        case 200:
          setSaved(true);
          break;
        case 400:
          setError("Invalid cron expression");
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
        Sync Schedule
      </h3>
      <p className={classNames("text-sm", "text-gray-600", "mb-2")}>
        Cron expression (e.g. &quot;0 7 * * *&quot; for daily at 7am)
      </p>
      <TextInput
        placeholder="0 7 * * *"
        value={cronSchedule}
        onChange={(e) => {
          setCronSchedule((e.target as HTMLInputElement).value);
          setSaved(false);
        }}
      />
      <label
        className={classNames(
          "flex",
          "items-center",
          "justify-center",
          "mb-2",
          "select-none",
          "cursor-pointer"
        )}
      >
        <input
          type="checkbox"
          checked={cronEnabled}
          onChange={(e) => {
            setCronEnabled(e.target.checked);
            setSaved(false);
          }}
          className={classNames("mr-2")}
        />
        Enable automatic sync
      </label>
      <Button label="Save schedule" onClick={handleSave} />
      {error && (
        <p className={classNames("my-2", "text-red-700", "text-sm")}>
          {error}
        </p>
      )}
      {saved && (
        <p className={classNames("my-2", "text-green-700", "text-sm")}>
          Schedule saved
        </p>
      )}
    </div>
  );
}

export default ScheduleForm;
