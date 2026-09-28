import { useCallback, useState } from "react";
import QrScanner from "./components/QrScanner";
import { getCollectionRecordByNumber } from './api/records';
import type { CollectionRecord } from './types';



function Touroku() {
  // const [recordNumber, setRecordNumber] = useState("");
  const [japaneseSpeciesName, setJapaneseSpeciesName] = useState("");

  const [searchNumber, setSearchNumber] = useState("");
  const [foundRecord, setFoundRecord] = useState<CollectionRecord | null>(null);
  // const [searchMessage, setSearchMessage] = useState("");

  const handleScan = useCallback((text: string) => {
    setSearchNumber(text);
  }, []);

  async function handleSearch() {
    const number = Number(searchNumber);

    if (!Number.isInteger(number) || number < 1) {
      return;
    }

    const record = await getCollectionRecordByNumber(number);
    setFoundRecord(record);
}

  //   if (!Number.isInteger(number) || number < 1) {
  //     setSearchMessage("正しい登録番号を入力してください。");
  //     return;
  //   }

  //   try {
  //     setSearchMessage("");
  //     const record = await getCollectionRecordByNumber(number);
  //     setFoundRecord(record);

  //     if (!record) {
  //       setSearchMessage("該当する記録がありません。");
  //     }
  //   } catch (error) {
  //     setFoundRecord(null);
  //     setSearchMessage(
  //       error instanceof Error ? error.message : "検索に失敗しました。"
  //     );
  //   }
  // }

  function startVoiceInput() {
  const SpeechRecognition =
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("このブラウザでは音声入力に対応していません");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const spokenText = event.results[0][0].transcript;
    setJapaneseSpeciesName(spokenText);
  };

  recognition.start();
}

  return (
    <main>

      <QrScanner onScan={handleScan} />
      <div>
      <label htmlFor="search-number">標本番号</label>
      <input
        id="search-number"
        value={searchNumber}
        onChange={(event) => setSearchNumber(event.target.value)}
      />

  <button type="button" onClick={handleSearch}>
    検索
  </button>

      </div>
  
      <div>
      <label htmlFor="japaneseSpeciesName">和名</label>
      <input
        id="japaneseSpeciesName"
        value={japaneseSpeciesName}
        onChange={(event) => setJapaneseSpeciesName(event.target.value)}
      />

<button type="button" onClick={startVoiceInput}>
  🎤 音声入力
</button>

      </div>

      {/* <label htmlFor="location">採集地</label>
      <input
        id="location"
        value={foundRecord.location}
      />

      <label htmlFor="date">採集日</label>
      <input
        id="date"
        value={foundRecord.date}
      /> */}



{foundRecord ? (
<div>
<p>採集地：{foundRecord.location}</p>
<p>採集日：{foundRecord.date}</p>
<p>採集者：{foundRecord.collector}</p>
<p>採集方法：{foundRecord.collectingMethod}</p>
</div>
):(<p>QR読み取りor番号入力後に、採集イベントを検索</p>)
}
    </main>
  );
}

export default Touroku;


// export type CollectionRecord = {
//   id: number;
//   cloudId: string;
//   location: string;
//   locationLabel: string;
//   locationRomaji: string;
//   latitude: number;
//   longitude: number;
//   altitude: number;
//   date: string;
//   collector: string;
//   collectingMethod: string;
// };
