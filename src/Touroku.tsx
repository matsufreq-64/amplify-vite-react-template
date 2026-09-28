import { useCallback, useState } from "react";
import QrScanner from "./components/QrScanner";
import { getCollectionRecordByNumber } from './api/records';
import type { CollectionRecord } from './types';



function Touroku() {
  const [recordNumber, setRecordNumber] = useState("");
  const [japaneseSpeciesName, setJapaneseSpeciesName] = useState("");


  const [searchNumber, setSearchNumber] = useState("");
  const [foundRecord, setFoundRecord] = useState<CollectionRecord | null>(null);
  const [searchMessage, setSearchMessage] = useState("");

  const handleScan = useCallback((text: string) => {
    setRecordNumber(text);
  }, []);

  async function handleSearch() {
    const number = Number(searchNumber);

    if (!Number.isInteger(number) || number < 1) {
      setSearchMessage("正しい登録番号を入力してください。");
      return;
    }

    try {
      setSearchMessage("");
      const record = await getCollectionRecordByNumber(number);
      setFoundRecord(record);

      if (!record) {
        setSearchMessage("該当する記録がありません。");
      }
    } catch (error) {
      setFoundRecord(null);
      setSearchMessage(
        error instanceof Error ? error.message : "検索に失敗しました。"
      );
    }
  }

  return (
    <main>
<section>
  <h2>登録番号で検索</h2>

  <input
    type="text"
    inputMode="numeric"
    value={searchNumber}
    onChange={(event) => setSearchNumber(event.target.value)}
    placeholder="例：00000004"
  />

  <button type="button" onClick={handleSearch}>
    検索
  </button>

  {searchMessage && <p>{searchMessage}</p>}

  {foundRecord && (
    <div>
      <p>登録番号：{String(foundRecord.id).padStart(8, "0")}</p>
      <p>採集地：{foundRecord.location}</p>
      <p>採集日：{foundRecord.date}</p>
    </div>
  )}
</section>


      <QrScanner onScan={handleScan} />

      <label htmlFor="record-number">標本番号</label>
      <input
        id="record-number"
        value={recordNumber}
        onChange={(event) => setRecordNumber(event.target.value)}
      />

      <label htmlFor="japaneseSpeciesName">和名</label>
      <input
        id="japaneseSpeciesName"
        value={japaneseSpeciesName}
        onChange={(event) => setJapaneseSpeciesName(event.target.value)}
      />
    </main>
  );
}

export default Touroku;
