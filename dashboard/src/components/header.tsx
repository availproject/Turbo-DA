import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Text } from ".//text";
import Button from "./button";

async function Header() {
  return (
    <header className="sticky top-0 z-10 w-full h-16 bg-[#192A3D] border border-b-[#444753] shadow-[0px_4.37px_96.13px_-17.48px_#13151d] [border-image:linear-gradient(139deg,rgba(68,71,83,1)_0%,rgba(21,23,35,1)_100%)_1] px-10 py-3 flex items-center justify-between ">
      <Image alt="Avail logo" src="/logo.svg" width={138} height={40} />
      <div className="flex items-center justify-between gap-x-6">
        <Link href={"#"} target="_blank">
          <Text size={"base"} weight={"bold"}>
            Read Docs
          </Text>
        </Link>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal" component="div">
            <Button className="w-[180px]">Sign In</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </header>
  );
}

export default Header;
