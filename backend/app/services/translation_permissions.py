"""Recheck a release and the exact outbound experiment before every real call."""
from fastapi import HTTPException
from app.models.dialect import DialectRelease, DialectReleaseCard
from app.services.dataset_package import checksum, make_package
from app.services.dataset_release import validate_download
from app.services.translation_evaluation import prepare, require, text, validate_cases


def validate_live_release(document, db):
    validate_cases(document)
    require(document['dataset']['origin'] == 'release')
    from app.routers.dialect import eligible, release_grouping_items
    row = db.get(DialectRelease, document['dataset']['version'])
    require(row is not None, 'Không tìm thấy phiên bản dữ liệu; chưa gửi yêu cầu dịch.')
    card = db.get(DialectReleaseCard, row.id)
    require(card is not None and checksum(row.records) == row.checksum, 'Bản dữ liệu không còn toàn vẹn.')
    try:
        items = eligible(db)
        validate_download(db, row.records, items, card.data_card, grouping_items=release_grouping_items(db, items))
    except HTTPException:
        raise ValueError('Quyền, nội dung hoặc nhóm dữ liệu đã thay đổi; tải bản phát hành mới trước khi thử dịch.') from None
    package = make_package(row.id, row.created_at, row.records, card.data_card)
    require(package['manifest']['package_sha256'] == document['dataset']['package_sha256'], 'Tệp thử dịch không khớp phiên bản trên máy chủ.')
    expected = prepare(package, len(document['cases']))
    require(document['adaptation'] == expected['adaptation'] and document['required_regions'] == expected['required_regions'], 'Từ điển bổ sung không đúng tập huấn luyện đã phát hành.')
    require(len(expected['cases']) == len(document['cases']))
    for actual, original in zip(document['cases'], expected['cases']):
        require(all(actual[k] == original[k] for k in ('id', 'group', 'source', 'region', 'kind')), 'Đã thay đổi câu kiểm tra hoặc trộn tập; cần chuẩn bị lại tệp thử dịch.')
        require(text(original['references'][0]) in {text(r) for r in actual['references']}, 'Đáp án tham chiếu không khớp bản chuẩn hóa; cần phát hành phiên bản mới.')
