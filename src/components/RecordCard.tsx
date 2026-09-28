import type { RecordCardProps } from '../types';

// 登録済内容の表示
export default function RecordCard({ record,onDelete, }: RecordCardProps) {
  return (
    <article>
      {/* <h2>{record.speciesName}</h2> */}
      <p>採集ID：{record.id}</p>
      <p>採集地（日本語）：{record.location}</p>
      <p>採集地（ラベル）：{record.locationLabel}</p>
      <p>採集地（ローマ字）：{record.locationRomaji}</p>
      <p>緯度,経度,標高： {record.latitude}, {record.longitude}, alt.{record.altitude}m</p>      
      <p>採集日：{record.date}</p>
      <p>採集者：{record.collector}</p>
      <p>採集方法：{record.collectingMethod}</p>

      <button
        type = "button"
        onClick={()=>{
          onDelete(record.cloudId);
        }}
      >
      削除
      </button>
    </article>
  );
}
