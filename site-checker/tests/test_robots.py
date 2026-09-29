from app import robots

BLOCK_ALL = "User-agent: *\nDisallow: /\n"
GPT_ONLY = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n"
OURS = "User-agent: TelaLoomSiteCheck\nDisallow: /\n"
OPEN = "User-agent: *\nDisallow: /admin/\nSitemap: https://x.example/sitemap.xml\nsitemap: https://x.example/s2.xml # c\n"


def test_wildcard_block_detected():
    assert robots.blocks_all_for(BLOCK_ALL, "Googlebot") == "wildcard"
    assert robots.blocks_all_for(BLOCK_ALL, "GPTBot") == "wildcard"


def test_specific_group_beats_wildcard():
    assert robots.blocks_all_for(GPT_ONLY, "GPTBot") == "specific"
    assert robots.blocks_all_for(GPT_ONLY, "ClaudeBot") == ""
    assert robots.blocks_all_for(GPT_ONLY, "Googlebot") == ""


def test_specific_allow_overrides_wildcard_block():
    text = "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /\n"
    assert robots.blocks_all_for(text, "GPTBot") == ""
    assert robots.blocks_all_for(text, "ClaudeBot") == "wildcard"


def test_partial_disallow_is_not_a_block():
    assert robots.blocks_all_for(OPEN, "GPTBot") == ""


def test_opt_out_only_for_our_named_group():
    assert robots.specific_group_blocks_all(OURS, "TelaLoomSiteCheck")
    assert not robots.specific_group_blocks_all(BLOCK_ALL, "TelaLoomSiteCheck")  # wildcard alone isn't an opt-out
    assert not robots.specific_group_blocks_all(OPEN, "TelaLoomSiteCheck")


def test_multiple_agents_share_a_group():
    text = "User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n"
    assert robots.blocks_all_for(text, "GPTBot") == "specific"
    assert robots.blocks_all_for(text, "ClaudeBot") == "specific"
    assert robots.blocks_all_for(text, "CCBot") == ""


def test_sitemaps_and_comments():
    assert robots.sitemaps(OPEN) == ["https://x.example/sitemap.xml", "https://x.example/s2.xml"]


def test_garbage_is_safe():
    assert robots.blocks_all_for("<html>404</html>\x00\xff", "GPTBot") == ""
    assert robots.sitemaps("") == []
    assert robots.blocks_all_for(None, "GPTBot") == ""
