import { useState, useEffect, type FormEvent } from 'react';
import { toRomaji } from "wanakana";
import { useAuthenticator } from '@aws-amplify/ui-react';
import RecordCard from './components/RecordCard';
import CollectionMap from './components/CollectionMap';
import {fetchElevation, fetchHeartRailsPlace,} from './api/location';
import { loadCollectionRecords, saveCollectionRecord, removeCollectionRecord } from './api/records';

import type {
  Position,
  // ElevationResponse,
  // HeartRailsLocation,
  // HeartRailsResponse,
  // MapClickHandlerProps,
  CollectionRecord,
} from './types';

function getTodayString() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    today.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function App() {
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [recordError, setRecordError] = useState('');
  const { signOut } = useAuthenticator();
  const [date, setDate] = useState(getTodayString);
  const [collector, setCollector] = useState('S. Matsubara');
  const [collectingMethod, setCollectingMethod] = useState('灯火');
  // const [elevation, setElevation] =useState<number | null>(null);
  // const [isLoadingElevation, setIsLoadingElevation] =useState(false);
  // const [elevationError, setElevationError] =useState('');
  const [selectedPosition, setSelectedPosition] =useState<Position | null>(null);
  const [placeName, setPlaceName] = useState('');
  // const [isLoadingPlaceName, setIsLoadingPlaceName] =useState(false);
  // const [placeNameError, setPlaceNameError] =useState('');
  const [latitudeInput, setLatitudeInput] =useState('');
  const [longitudeInput, setLongitudeInput] =useState('');
  const [elevationInput, setElevationInput] =useState('');


  const [placeNameRomaji, setPlaceNameRomaji] = useState('');

  const [isLoadingMapInformation, setIsLoadingMapInformation] =useState(false);
  const [mapInformationError, setMapInformationError] =useState('');

  useEffect(() => {
    let active = true;
    loadCollectionRecords()
      .then((loaded) => { if (active) setRecords(loaded); })
      .catch((error) => {
        if (active) setRecordError(error instanceof Error ? error.message : '記録を読み込めませんでした。');
      })
      .finally(() => { if (active) setIsLoadingRecords(false); });
    return () => { active = false; };
  }, []);

// ==========================================================================

// ==========================================================================
async function selectPosition(
  latitude: number,
  longitude: number
) {
  // クリック位置をそのまま入力
  setLatitudeInput(latitude.toFixed(4));
  setLongitudeInput(longitude.toFixed(4));
  setSelectedPosition({latitude,longitude,});

  // 前回選んだ地点の値を消す
  setElevationInput('');
  setPlaceName('');
  setMapInformationError('');
  setIsLoadingMapInformation(true);

try {
    const [elevation, place] = await Promise.all([
      fetchElevation(latitude, longitude),
      fetchHeartRailsPlace(latitude, longitude),
    ]);

    setElevationInput(String(elevation));
    setPlaceName(place.placeName);
    setPlaceNameRomaji(toRomaji(place.placeNameKana));
  } catch (error) {
    setMapInformationError(
      error instanceof Error
        ? error.message
        : '地点情報の取得中にエラーが発生しました。'
    );
  } finally {
    setIsLoadingMapInformation(false);
  }
}

// ==========================================================================

// 採集実施記録を削除する関数
// ==========================================================================
async function deleteRecord(cloudId: string) {
  setRecordError('');
  try {
    await removeCollectionRecord(cloudId);
    setRecords((current) => current.filter((record) => record.cloudId !== cloudId));
  } catch (error) {
    setRecordError(error instanceof Error ? error.message : '記録を削除できませんでした。');
  }
}

// ==========================================================================

// 記録追加時の処理
// ==========================================================================
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || isLoadingRecords) return;
    setRecordError('');

    if (!elevationInput || !placeNameRomaji ||
        !Number.isFinite(Number(latitudeInput)) ||
        !Number.isFinite(Number(longitudeInput)) ||
        !Number.isFinite(Number(elevationInput))) {
      setRecordError('採集地のローマ字、緯度・経度・標高を確認してください。');
      return;
    }

    // const nextId =
    //   records.length === 0
    //     ? 1
    //     : Math.max(...records.map((record) => record.id)) + 1;

    // newRecordという変数に入力欄の内容を代入する
    const newRecord: Omit<CollectionRecord, "id" | "cloudId"> = {
        // id: nextId,
      location: placeName,
      locationRomaji: placeNameRomaji,
      latitude: Number(latitudeInput),
      longitude: Number(longitudeInput),
      altitude: Number(elevationInput),
      date,
      collector,
      collectingMethod,
    };

  try {
    setIsSaving(true);
    const saved = await saveCollectionRecord(newRecord);
    setRecords((current) => [...current, saved]);
  } catch (error) {
    setRecordError(error instanceof Error ? error.message : '保存できませんでした。');
    return;
  } finally {
    setIsSaving(false);
  }

    // 登録後に入力欄の値を元に戻す
    setPlaceName('');
    setPlaceNameRomaji('');
    setLatitudeInput('');
    setLongitudeInput('');
    setElevationInput('');
    setDate(getTodayString());
    // 採集者、採集方法はデフォルト値が入っているようにしたいので、空文字にしない
    // setCollector('');
    // setCollectingMethod('');

    // マップ上の選択状態を未選択に戻す
    setSelectedPosition(null);
  }

// ==========================================================================

// Appのreturn
// ==========================================================================
  return (
    <main>
      <h1>採集記録アプリ</h1>
      <button type="button" onClick={signOut}>ログアウト</button>
      <h2>採集地点</h2>
      <CollectionMap
        selectedPosition={selectedPosition}
        onSelect={selectPosition}
      />
      <small>
        出典：
        <a
          href="https://nlftp.mlit.go.jp/"
          target="_blank"
          rel="noreferrer"
        >
          「位置参照情報ダウンロードサービス」
          （国土交通省）
        </a>
        を加工して作成
      </small>

{/* 地図を未クリック時の文言 */}
{selectedPosition === null ? 
(<p>地図上の地点をクリックしてください。</p>) :
(<div></div>)}

{/* 地図の内容取得時の文言 */}
{isLoadingMapInformation && (
  <p>地点情報を取得しています……</p>
)}

{/* エラー時の表示 */}
{mapInformationError !== '' && (
  <p>{mapInformationError}</p>
)}

{/* 入力フォーム */}
<form onSubmit={handleSubmit}>
  <div>
  <label htmlFor="placeName">採集地</label>
    <input
      id="placeName"
      type="text"
      value={placeName}
      onChange={(event) => {setPlaceName(event.target.value);}}
      required
      style={{
      width: `${Math.max(placeName.length + 2, 10)}em`,
      maxWidth: '100%',
      }}
    />
  </div>

  <div>
  <label htmlFor="placeNameRomaji">採集地（ローマ字）</label>
    <input
      id="placeNameRomaji"
      type="text"
      value={placeNameRomaji}
      onChange={(event) => {setPlaceNameRomaji(event.target.value);}}
      required
      style={{
      width: `${Math.max(placeNameRomaji.length - 5, 10)}em`,
      maxWidth: '100%',
      }}
    />
  </div>

  <div>
    <label htmlFor="latitude">緯度</label>
    <input
      id="latitude"
      type="number"
      step="any"
      value={latitudeInput}
      onChange={(event) => {setLatitudeInput(event.target.value);}}
      required
    />
  </div>

  <div>
    <label htmlFor="longitude">経度</label>
    <input
      id="longitude"
      type="number"
      step="any"
      value={longitudeInput}
      onChange={(event) => {setLongitudeInput(event.target.value);}}
      required
    />
  </div>

  <div>
    <label htmlFor="elevation">標高</label>
    <input
      id="elevation"
      type="number"
      step="any"
      value={elevationInput}
      onChange={(event) => {setElevationInput(event.target.value);}}
      required
    />
    <span> m</span>
  </div>


  <div>
    <label htmlFor="date">採集日</label>
    <input
      id="date"
      type="date"
      value={date}
      onChange={(event) => {setDate(event.target.value);}}
      required
    />
  </div>

  <div>
    <label htmlFor="collector">採集者</label>
    <input
      id="collector"
      type="text"
      value={collector}
      onChange={(event) => {setCollector(event.target.value);}}
      required
    />
  </div>

  <div>
    <label htmlFor="collectingMethod">採集方法</label>
    <input
      id="collectingMethod"
      type="text"
      value={collectingMethod}
      onChange={(event) => {setCollectingMethod(event.target.value);}}
      required
    />
  </div>


  <button type="submit" disabled={isSaving || isLoadingRecords}>
    {isSaving ? '保存中…' : '記録を追加'}
  </button>
</form>

{/* 登録済内容の表示 */}
{isLoadingRecords && <p>記録を読み込んでいます……</p>}
{recordError && <p role="alert">{recordError}</p>}
<p>登録件数：{records.length}件</p>
{records.map((record) => (
<RecordCard key={record.id} record={record} onDelete={deleteRecord}/>
))}

</main>
);
}

export default App;
